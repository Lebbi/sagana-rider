import { describe, expect, it, jest } from "@jest/globals";

import api from "@/lib/api";
import { deleteAccount, deleteErrorMessages, isSessionGone } from "@/lib/accountDeletion";

jest.mock("@/lib/api", () => ({ __esModule: true, default: { delete: jest.fn() } }));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const failure = (status: number, data: object = {}) => ({ response: { status, data } });

describe("deleteAccount", () => {
  it("sends the password in the body the backend reads", async () => {
    await deleteAccount("secret");
    expect(api.delete).toHaveBeenCalledWith("/user", { data: { password: "secret" } });
  });
});

describe("deleteErrorMessages", () => {
  it("shows every blocking reason as given", () => {
    const error = failure(409, {
      message: "Summary",
      reasons: [
        { code: "ACTIVE_DELIVERY", message: "You have a delivery still in progress." },
        { code: "RIDER_EARNINGS", message: "You have unpaid earnings." },
      ],
    });
    expect(deleteErrorMessages(error)).toEqual(["You have a delivery still in progress.", "You have unpaid earnings."]);
  });

  it("falls back to the server message, then a local one, when a 409 has no reasons", () => {
    expect(deleteErrorMessages(failure(409, { message: "Blocked." }))).toEqual(["Blocked."]);
    expect(deleteErrorMessages(failure(409))[0]).toMatch(/can't be deleted/);
  });

  it("shows the wrong-password message on 422", () => {
    expect(deleteErrorMessages(failure(422, { message: "Wrong password." }))).toEqual(["Wrong password."]);
    expect(deleteErrorMessages(failure(422))[0]).toMatch(/password/);
  });

  it("asks for a retry on anything else, without echoing server text", () => {
    expect(deleteErrorMessages(failure(500, { message: "SQLSTATE" }))[0]).toMatch(/try again/);
    expect(deleteErrorMessages(new Error("Network Error"))[0]).toMatch(/try again/);
  });
});

describe("isSessionGone", () => {
  it("is true only for a 401", () => {
    expect(isSessionGone(failure(401))).toBe(true);
    expect(isSessionGone(failure(409))).toBe(false);
    expect(isSessionGone(new Error("x"))).toBe(false);
  });
});
