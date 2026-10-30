import { STATUS_TIMELINE, getTimelineStepStates } from "../orderTimeline";

const statuses = STATUS_TIMELINE.map((s) => s.status);

describe("getTimelineStepStates", () => {
  it("marks only the first step current for searching", () => {
    const states = getTimelineStepStates("searching");
    expect(states[0]).toBe("current");
    expect(states.slice(1).every((s) => s === "future")).toBe(true);
  });

  it("marks earlier steps done mid-delivery", () => {
    const states = getTimelineStepStates("to_delivery");
    const idx = statuses.indexOf("to_delivery");
    expect(states.slice(0, idx).every((s) => s === "done")).toBe(true);
    expect(states[idx]).toBe("current");
    expect(states.slice(idx + 1).every((s) => s === "future")).toBe(true);
  });

  it("completes through delivered and leaves cancelled future", () => {
    const states = getTimelineStepStates("delivered");
    const idx = statuses.indexOf("delivered");
    expect(states.slice(0, idx).every((s) => s === "done")).toBe(true);
    expect(states[idx]).toBe("current");
    expect(states[statuses.indexOf("cancelled")]).toBe("future");
  });

  it("marks only cancelled current for a cancelled order", () => {
    const states = getTimelineStepStates("cancelled");
    states.forEach((s, i) => {
      expect(s).toBe(statuses[i] === "cancelled" ? "current" : "future");
    });
  });

  it("marks everything future for an unknown status", () => {
    const states = getTimelineStepStates("some_unknown_status");
    expect(states).toHaveLength(STATUS_TIMELINE.length);
    expect(states.every((s) => s === "future")).toBe(true);
  });
});
