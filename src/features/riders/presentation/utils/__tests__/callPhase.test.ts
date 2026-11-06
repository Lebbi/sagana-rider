import { describe, expect, it } from "@jest/globals";

import { callReducer, shouldTellCallee, type CallEvent, type CallPhase } from "../callPhase";

const run = (...events: CallEvent[]): CallPhase =>
  events.reduce(callReducer, { kind: "connecting" } as CallPhase);

describe("outgoing call phases", () => {
  it("rings once joined and connects when the callee answers", () => {
    expect(run({ type: "joined" })).toEqual({ kind: "ringing" });
    expect(run({ type: "joined" }, { type: "remote_joined", at: 5 })).toEqual({ kind: "connected", since: 5 });
  });

  it("an unanswered ring ends as no answer, and the callee is told to stop ringing", () => {
    const phase = run({ type: "joined" }, { type: "ring_timeout" });
    expect(phase).toEqual({ kind: "ended", reason: "no_answer" });
    expect(shouldTellCallee("no_answer")).toBe(true);
  });

  it("the ring timeout does nothing once the call is connected", () => {
    expect(run({ type: "joined" }, { type: "remote_joined", at: 1 }, { type: "ring_timeout" }).kind).toBe("connected");
  });

  it("the other side ending reads as declined while ringing and hung up once connected", () => {
    expect(run({ type: "joined" }, { type: "remote_ended" })).toEqual({ kind: "ended", reason: "declined" });
    expect(run({ type: "joined" }, { type: "remote_joined", at: 1 }, { type: "remote_ended" })).toEqual({
      kind: "ended",
      reason: "remote_hung_up",
    });
    expect(shouldTellCallee("declined")).toBe(false);
    expect(shouldTellCallee("remote_hung_up")).toBe(false);
  });

  it("an ended call stays ended", () => {
    expect(run({ type: "hang_up" }, { type: "remote_joined", at: 1 }, { type: "joined" })).toEqual({
      kind: "ended",
      reason: "hung_up",
    });
  });
});
