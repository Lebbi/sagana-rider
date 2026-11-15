import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import * as Sentry from "@sentry/react-native";

import { initSentry, scrubBreadcrumb, setSentryUser } from "../sentry";

jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  getClient: jest.fn(() => undefined),
  setUser: jest.fn(),
  captureException: jest.fn(),
}));

const mocked = jest.mocked(Sentry);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("initSentry", () => {
  it("does nothing without a DSN, so local runs and Expo Go send nothing", () => {
    expect(initSentry(undefined)).toBe(false);
    expect(initSentry("")).toBe(false);
    expect(mocked.init).not.toHaveBeenCalled();
  });

  it("starts once with no default PII and the app variant tag", () => {
    expect(initSentry("https://key@o1.ingest.sentry.io/1")).toBe(true);
    const options = mocked.init.mock.calls[0][0]!;
    expect(options.sendDefaultPii).toBe(false);
    expect(options.initialScope).toEqual({ tags: { app_variant: "rider", build_profile: "local" } });
  });

  it("does not start twice", () => {
    mocked.getClient.mockReturnValueOnce({} as never);
    expect(initSentry("https://key@o1.ingest.sentry.io/1")).toBe(false);
  });
});

describe("setSentryUser", () => {
  it("sends the id only and clears placeholder or missing users", () => {
    setSentryUser(42);
    setSentryUser(-1);
    setSentryUser(null);
    expect(mocked.setUser.mock.calls).toEqual([[{ id: "42" }], [null], [null]]);
  });
});

describe("scrubBreadcrumb", () => {
  it("drops console logs and strips query strings from URLs", () => {
    expect(scrubBreadcrumb({ category: "console", message: "user@x.com" })).toBeNull();
    expect(scrubBreadcrumb({ category: "fetch", data: { url: "https://api/x?phone=0917", method: "GET" } })).toEqual({
      category: "fetch",
      data: { url: "https://api/x", method: "GET" },
    });
  });
});
