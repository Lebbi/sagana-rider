/**
 * context/AutoAcceptContext.tsx — Sagana Rider
 *
 * Client-side auto-accept engine (pilot Phase 1).
 *
 * What it does:
 *   When the rider enables "Auto-Accept Orders" AND is on duty (isOnline),
 *   and has NO active order, this provider polls GET /rider/orders every
 *   POLL_INTERVAL_MS. When it finds a `searching` order it starts a
 *   COUNTDOWN_SECONDS countdown (green banner, tappable "Not now"),
 *   then auto-accepts the OLDEST searching order (FIFO) and navigates
 *   to the Active Delivery page — from any tab.
 *
 * Guardrails:
 *   - Foreground only (AppState pause/resume). Auto-accept does not run
 *     while the app is backgrounded or killed.
 *   - One active order at a time (pilot single-order model). The countdown
 *     never starts while the rider already has an in-progress order.
 *   - 422 race-loss (another rider accepted first) → order skipped
 *     silently, scanning continues.
 *   - "Not now" on the banner cancels the countdown and skips that
 *     specific order for the session (added to a skip-set).
 *
 * Post-pilot: replace with server-side dispatch + expo-notifications push.
 */

import { fontFamily, fontWeight } from "@/constants/FontTheme";
import { useColors } from "@/hooks/useColors";
import { acceptOrder, getRiderOrders } from "@/lib/riderOrdersApi";
import { handleApiError, handleApiSuccess } from "@/utils/errorHandler";
import { useRouter } from "expo-router";
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ── Tunables ───────────────────────────────────────────────────
const POLL_INTERVAL_MS = 25_000; // scan cadence
const COUNTDOWN_SECONDS = 10; // "Not now" abort window
// ───────────────────────────────────────────────────────────────

/** Statuses that mean the rider is mid-delivery (single-order model). */
const ACTIVE_STATUSES = [
  "accepted",
  "to_pickup",
  "arrived_pickup",
  "picked_up",
  "to_delivery",
  "arrived_delivery",
];

export type AutoAcceptPhase = "idle" | "scanning" | "countdown" | "paused";

type PendingTarget = {
  orderId: number;
};

type AutoAcceptContextType = {
  phase: AutoAcceptPhase;
  /** Seconds remaining when phase === "countdown" */
  secondsLeft: number;
  /** The order about to be auto-accepted (for banner copy) */
  pending: PendingTarget | null;
  /** Rider settings as last known (mirrors backend) */
  autoAcceptEnabled: boolean;
  isOnline: boolean;
  /** Toggle handlers (mirror-only; persistence stays in Home) */
  setAutoAcceptEnabled: (value: boolean) => void;
  setIsOnline: (value: boolean) => void;
  /** Cancel current countdown ("Not now") — skips the pending order */
  cancelCountdown: () => void;
};

const AutoAcceptContext = createContext<AutoAcceptContextType | undefined>(
  undefined,
);

export const useAutoAccept = () => {
  const ctx = useContext(AutoAcceptContext);
  if (!ctx) throw new Error("useAutoAccept must be used within AutoAcceptProvider");
  return ctx;
};

/**
 * Green countdown chip. Fixed above the tab bar so it is visible from
 * any tab. Whole chip is tappable = "Not now" (≥44pt target).
 */
export function AutoAcceptBanner() {
  const { phase, secondsLeft, pending, cancelCountdown } = useAutoAccept();
  const colors = useColors();

  if (phase !== "countdown" || !pending) return null;

  return (
    <View style={styles.bannerWrap} pointerEvents="box-none">
      <Pressable
        style={[styles.banner, { backgroundColor: colors.success }]}
        onPress={cancelCountdown}
        accessibilityRole="button"
        accessibilityLabel={`Cancel auto accept of order ${pending.orderId}`}
      >
        <Text style={styles.bannerTitle}>
          AUTO ACCEPTING AFTER {secondsLeft}s
        </Text>
        <Text style={styles.bannerSub}>
          Order #{pending.orderId} — tap to skip
        </Text>
        <Text style={styles.bannerNotNow}>NOT NOW</Text>
      </Pressable>
    </View>
  );
}

export function AutoAcceptProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [phase, setPhase] = useState<AutoAcceptPhase>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pending, setPending] = useState<PendingTarget | null>(null);
  const [autoAcceptEnabled, setAutoAcceptEnabledState] = useState(false);
  const [isOnline, setIsOnlineState] = useState(false);

  // Refs so the async loops always read current values without re-subscribing
  const appStateRef = useRef(AppState.currentState);
  const skipSetRef = useRef<Set<number>>(new Set());
  const busyRef = useRef(false); // guards against overlapping scans/accepts
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<AutoAcceptPhase>("idle");
  const settingsRef = useRef({ autoAcceptEnabled: false, isOnline: false });

  const setPhaseSafe = useCallback((next: AutoAcceptPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    settingsRef.current = { autoAcceptEnabled, isOnline };
  }, [autoAcceptEnabled, isOnline]);

  // ── Accept ───────────────────────────────────────────────────
  const performAccept = useCallback(
    async (orderId: number) => {
      try {
        await acceptOrder(orderId);
        handleApiSuccess("Order Auto-Accepted", "The order is now yours to deliver.");
        setPhaseSafe("paused"); // hold scanning until next poll re-checks
        // Navigate to the Active Delivery page — same path as manual accept
        router.push({
          pathname: "/tabs/ActiveDeliveryPage",
          params: { orderId: String(orderId) },
        } as never);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 422) {
          // Race lost — another rider took it. Silent skip; keep scanning.
          skipSetRef.current.add(orderId);
          setPhaseSafe("scanning");
        } else {
          // Network/backend error — back off; next poll retries
          handleApiError(e, "Auto-accept failed. Will retry.");
          skipSetRef.current.add(orderId);
          setPhaseSafe("scanning");
        }
      } finally {
        setPending(null);
        setSecondsLeft(0);
      }
    },
    [router, setPhaseSafe],
  );

  // ── Countdown ────────────────────────────────────────────────
  const stopCountdownTimer = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const cancelCountdownInternal = useCallback(() => {
    stopCountdownTimer();
    setPending(null);
    setSecondsLeft(0);
    setPhaseSafe("scanning");
  }, [setPhaseSafe, stopCountdownTimer]);

  const cancelCountdown = useCallback(() => {
    setPending((p) => {
      if (p) skipSetRef.current.add(p.orderId);
      return p;
    });
    cancelCountdownInternal();
  }, [cancelCountdownInternal]);

  const startCountdown = useCallback(
    (target: PendingTarget) => {
      stopCountdownTimer();
      setPending(target);
      setSecondsLeft(COUNTDOWN_SECONDS);
      setPhaseSafe("countdown");

      countdownRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            void performAccept(target.orderId);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    },
    [performAccept, setPhaseSafe, stopCountdownTimer],
  );

  // ── Scan (polling) ───────────────────────────────────────────
  const scanForOrder = useCallback(async () => {
    const settings = settingsRef.current;
    if (
      busyRef.current ||
      phaseRef.current === "countdown" ||
      !settings.autoAcceptEnabled ||
      !settings.isOnline ||
      appStateRef.current !== "active"
    ) {
      return;
    }

    busyRef.current = true;
    try {
      const orders = await getRiderOrders();

      // Rider already has an active order → hold (single-order model).
      // This is also what gives the post-delivery breathing room: the scan
      // only resumes once no in-progress order exists anymore.
      const hasActive = orders.some((o) => ACTIVE_STATUSES.includes(o.status));
      if (hasActive) {
        setPhaseSafe("paused");
        return;
      }

      // Oldest searching order first (FIFO) — order id as age proxy.
      // Orders skipped this session ("Not now" / race-lost) are excluded.
      const candidates = orders
        .filter((o) => o.status === "searching")
        .filter((o) => !skipSetRef.current.has(o.orderId))
        .sort((a, b) => a.orderId - b.orderId);

      if (candidates.length > 0) {
        startCountdown({ orderId: candidates[0].orderId });
      } else {
        setPhaseSafe("scanning");
      }
    } catch (e) {
      if (__DEV__) console.warn("[AutoAccept] Scan failed:", e);
      // Don't change phase on transient errors; next poll retries.
    } finally {
      busyRef.current = false;
    }
  }, [startCountdown, setPhaseSafe]);

  // ── Poll interval ────────────────────────────────────────────
  useEffect(() => {
    pollRef.current = setInterval(() => {
      void scanForOrder();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [scanForOrder]);

  // ── AppState listener (pause/resume) ──────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      appStateRef.current = state;
      if (state === "active") {
        void scanForOrder(); // resume immediately on foreground
      } else {
        // Background → cancel any live countdown (rider can't see the banner)
        cancelCountdownInternal();
      }
    });
    return () => sub.remove();
  }, [scanForOrder, cancelCountdownInternal]);

  // ── Cleanup on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopCountdownTimer();
    };
  }, [stopCountdownTimer]);

  const setAutoAcceptEnabled = useCallback((value: boolean) => {
    setAutoAcceptEnabledState(value);
    settingsRef.current.autoAcceptEnabled = value;
    if (!value) cancelCountdownInternal();
  }, [cancelCountdownInternal]);

  const setIsOnline = useCallback((value: boolean) => {
    setIsOnlineState(value);
    settingsRef.current.isOnline = value;
    if (!value) cancelCountdownInternal();
  }, [cancelCountdownInternal]);

  const value = useMemo<AutoAcceptContextType>(
    () => ({
      phase,
      secondsLeft,
      pending,
      autoAcceptEnabled,
      isOnline,
      setAutoAcceptEnabled,
      setIsOnline,
      cancelCountdown,
    }),
    [
      phase,
      secondsLeft,
      pending,
      autoAcceptEnabled,
      isOnline,
      setAutoAcceptEnabled,
      setIsOnline,
      cancelCountdown,
    ],
  );

  return (
    <AutoAcceptContext.Provider value={value}>
      {children}
    </AutoAcceptContext.Provider>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    position: "absolute",
    bottom: 90,
    left: 16,
    right: 16,
  },
  banner: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 72, // ≥44pt tap target
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    fontSize: 13,
  },
  bannerSub: {
    color: "rgba(255, 255, 255, 0.92)",
    fontFamily: fontFamily.medium,
    fontWeight: fontWeight.medium,
    fontSize: 11,
    marginTop: 2,
  },
  bannerNotNow: {
    color: "rgba(255, 255, 255, 0.95)",
    fontFamily: fontFamily.bold,
    fontWeight: fontWeight.bold,
    fontSize: 11,
    marginTop: 6,
    letterSpacing: 0.5,
  },
});
