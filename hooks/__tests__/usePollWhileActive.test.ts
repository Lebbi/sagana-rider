import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createElement } from "react";
import { AppState } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import {
  nextPollDelay,
  usePollWhileActive,
} from "../usePollWhileActive";

type Poll = () => Promise<boolean>;

// The rider app has no @testing-library/react-native, so a minimal renderHook.
async function renderHook<P>(hook: (props: P) => void, opts?: { initialProps: P }) {
  const Probe = ({ props }: { props: P }) => {
    hook(props);
    return null;
  };
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(createElement(Probe, { props: opts?.initialProps as P }));
  });
  return {
    rerender: (props: P) => act(async () => root.update(createElement(Probe, { props }))),
    unmount: () => act(async () => root.unmount()),
  };
}

const mockFocus: { cleanup?: () => void } = {};

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(() => {
        mockFocus.cleanup = cb() as (() => void) | undefined;
        return () => mockFocus.cleanup?.();
      }, [cb]);
    },
  };
});

let appStateListener: ((s: string) => void) | undefined;

beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(AppState, "currentState", {
    value: "active",
    configurable: true,
  });
  jest.spyOn(AppState, "addEventListener").mockImplementation(((
    _: string,
    l: (s: string) => void,
  ) => {
    appStateListener = l;
    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const advance = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

describe("nextPollDelay", () => {
  it("keeps the interval until three consecutive failures, then doubles up to 60s", () => {
    expect([0, 1, 2].map((n) => nextPollDelay(n))).toEqual([20000, 20000, 20000]);
    expect(nextPollDelay(3)).toBe(40000);
    expect(nextPollDelay(4)).toBe(60000);
    expect(nextPollDelay(9)).toBe(60000);
  });
});

describe("usePollWhileActive", () => {
  it("polls every 20 seconds", async () => {
    const poll = jest.fn<Poll>().mockResolvedValue(true);
    await renderHook(() => usePollWhileActive(poll, { enabled: true }));
    await advance(19_999);
    expect(poll).not.toHaveBeenCalled();
    await advance(1);
    expect(poll).toHaveBeenCalledTimes(1);
    await advance(20_000);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("does not overlap a poll that is still running", async () => {
    let resolve!: (v: boolean) => void;
    const poll = jest.fn(() => new Promise<boolean>((r) => (resolve = r)));
    await renderHook(() => usePollWhileActive(poll, { enabled: true }));
    await advance(100_000);
    expect(poll).toHaveBeenCalledTimes(1);
    resolve(true);
    await advance(20_000);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("skips a tick while shouldSkip is true", async () => {
    const poll = jest.fn<Poll>().mockResolvedValue(true);
    let skip = true;
    await renderHook(() =>
      usePollWhileActive(poll, { enabled: true, shouldSkip: () => skip }),
    );
    await advance(20_000);
    expect(poll).not.toHaveBeenCalled();
    skip = false;
    await advance(20_000);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("stops when disabled and restarts when re-enabled", async () => {
    const poll = jest.fn<Poll>().mockResolvedValue(true);
    const { rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) =>
        usePollWhileActive(poll, { enabled }),
      { initialProps: { enabled: true } },
    );
    await rerender({ enabled: false });
    await advance(60_000);
    expect(poll).not.toHaveBeenCalled();
    await rerender({ enabled: true });
    await advance(20_000);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("stops in the background and on blur, and resumes on return", async () => {
    const poll = jest.fn<Poll>().mockResolvedValue(true);
    await renderHook(() => usePollWhileActive(poll, { enabled: true }));
    await act(() => appStateListener?.("background"));
    await advance(60_000);
    expect(poll).not.toHaveBeenCalled();
    await act(() => appStateListener?.("active"));
    await advance(20_000);
    expect(poll).toHaveBeenCalledTimes(1);

    await act(() => mockFocus.cleanup?.());
    await advance(60_000);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("stops on unmount", async () => {
    const poll = jest.fn<Poll>().mockResolvedValue(true);
    const { unmount } = await renderHook(() =>
      usePollWhileActive(poll, { enabled: true }),
    );
    await unmount();
    await advance(60_000);
    expect(poll).not.toHaveBeenCalled();
  });

  it("backs off after three failures and resets on success", async () => {
    const poll = jest.fn<Poll>().mockResolvedValue(false);
    await renderHook(() => usePollWhileActive(poll, { enabled: true }));
    await advance(60_000);
    expect(poll).toHaveBeenCalledTimes(3);
    await advance(39_999);
    expect(poll).toHaveBeenCalledTimes(3);
    await advance(1);
    expect(poll).toHaveBeenCalledTimes(4);
    await advance(59_999);
    expect(poll).toHaveBeenCalledTimes(4);
    await advance(1);
    expect(poll).toHaveBeenCalledTimes(5);

    poll.mockResolvedValue(true);
    await advance(60_000);
    expect(poll).toHaveBeenCalledTimes(6);
    await advance(20_000);
    expect(poll).toHaveBeenCalledTimes(7);
  });

  it("treats a rejected poll as a failure", async () => {
    const poll = jest.fn<Poll>().mockRejectedValue(new Error("net"));
    await renderHook(() => usePollWhileActive(poll, { enabled: true }));
    await advance(60_000);
    expect(poll).toHaveBeenCalledTimes(3);
    await advance(39_999);
    expect(poll).toHaveBeenCalledTimes(3);
  });
});
