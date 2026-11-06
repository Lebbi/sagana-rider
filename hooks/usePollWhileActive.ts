// hooks/usePollWhileActive.ts

import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/** Pilot polling cadence while Reverb is unavailable. */
export const ORDER_POLL_INTERVAL_MS = 20_000;
export const POLL_MAX_BACKOFF_MS = 60_000;
export const POLL_FAILURES_BEFORE_BACKOFF = 3;

/** Doubles the interval for each failure past the third, capped at POLL_MAX_BACKOFF_MS. */
export function nextPollDelay(
  consecutiveFailures: number,
  intervalMs: number = ORDER_POLL_INTERVAL_MS,
): number {
  if (consecutiveFailures < POLL_FAILURES_BEFORE_BACKOFF) return intervalMs;
  const doublings = consecutiveFailures - POLL_FAILURES_BEFORE_BACKOFF + 1;
  return Math.min(intervalMs * 2 ** doublings, POLL_MAX_BACKOFF_MS);
}

interface PollOptions {
  /** Extra gate besides focus and foreground, e.g. "an order is loaded and not final". */
  enabled: boolean;
  intervalMs?: number;
  /** Checked at each tick. Return true to skip it, e.g. while an action is in flight. */
  shouldSkip?: () => boolean;
}

/**
 * Calls `poll` on a timer while the screen is focused, the app is in the foreground
 * and `enabled` is true. The next tick is scheduled only after the previous poll
 * settles, so polls never overlap. `poll` reports failure by resolving false or rejecting.
 */
export function usePollWhileActive(
  poll: () => Promise<boolean | void>,
  { enabled, intervalMs = ORDER_POLL_INTERVAL_MS, shouldSkip }: PollOptions,
): void {
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const pollRef = useRef(poll);
  const shouldSkipRef = useRef(shouldSkip);
  pollRef.current = poll;
  shouldSkipRef.current = shouldSkip;

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => sub.remove();
  }, []);

  const active = enabled && focused && foreground;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timer = setTimeout(tick, nextPollDelay(failures, intervalMs));
    };

    const tick = async () => {
      if (cancelled) return;
      if (!shouldSkipRef.current?.()) {
        try {
          failures = (await pollRef.current()) === false ? failures + 1 : 0;
        } catch {
          failures += 1;
        }
      }
      if (!cancelled) schedule();
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, intervalMs]);
}
