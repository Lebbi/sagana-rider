/** Where an outgoing in-app call is. "ended" is final: later events are ignored. */
export type CallEndReason =
  | "no_answer"
  | "declined"
  | "remote_hung_up"
  | "hung_up"
  | "no_microphone"
  | "unavailable"
  | "failed";

export type CallPhase =
  | { kind: "connecting" }
  | { kind: "ringing" }
  | { kind: "connected"; since: number }
  | { kind: "ended"; reason: CallEndReason };

export type CallEvent =
  | { type: "joined" }
  | { type: "remote_joined"; at: number }
  | { type: "remote_ended" }
  | { type: "ring_timeout" }
  | { type: "hang_up" }
  | { type: "failed"; reason: "no_microphone" | "unavailable" | "failed" };

export const RING_TIMEOUT_MS = 30_000;

export function callReducer(phase: CallPhase, event: CallEvent): CallPhase {
  if (phase.kind === "ended") return phase;
  switch (event.type) {
    case "joined":
      return phase.kind === "connecting" ? { kind: "ringing" } : phase;
    case "remote_joined":
      return phase.kind === "connected" ? phase : { kind: "connected", since: event.at };
    case "remote_ended":
      return { kind: "ended", reason: phase.kind === "connected" ? "remote_hung_up" : "declined" };
    case "ring_timeout":
      return phase.kind === "connected" ? phase : { kind: "ended", reason: "no_answer" };
    case "hang_up":
      return { kind: "ended", reason: "hung_up" };
    case "failed":
      return { kind: "ended", reason: event.reason };
  }
}

/** The callee's app is still ringing in these cases, so the rider's app must tell it to stop. */
export function shouldTellCallee(reason: CallEndReason): boolean {
  return reason === "no_answer" || reason === "hung_up" || reason === "failed";
}
