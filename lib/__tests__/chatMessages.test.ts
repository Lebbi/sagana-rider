import { describe, expect, it } from "@jest/globals";

import { latestMessageId, mergeMessages, type ChatMessage } from "../chatMessages";

const msg = (id: number, body = `m${id}`, pending?: boolean): ChatMessage => ({
  id,
  senderId: 1,
  body,
  createdAt: "2026-11-06 12:00:00",
  ...(pending ? { pending } : {}),
});

describe("mergeMessages", () => {
  it("adds new messages in id order without duplicating ones already held", () => {
    const merged = mergeMessages([msg(1), msg(3)], [msg(3), msg(2), msg(4)]);
    expect(merged.map((m) => m.id)).toEqual([1, 2, 3, 4]);
  });

  it("takes the incoming copy of a message it already holds", () => {
    const merged = mergeMessages([msg(1, "old")], [msg(1, "new")]);
    expect(merged).toEqual([msg(1, "new")]);
  });

  it("keeps a pending message after the real ones until it is replaced", () => {
    const merged = mergeMessages([msg(1), msg(-5, "sending", true)], [msg(2)]);
    expect(merged.map((m) => m.id)).toEqual([1, 2, -5]);
  });
});

describe("latestMessageId", () => {
  it("is the highest real id and ignores pending temp ids", () => {
    expect(latestMessageId([msg(4), msg(-99, "x", true), msg(7)])).toBe(7);
  });

  it("is undefined with no real messages", () => {
    expect(latestMessageId([])).toBeUndefined();
    expect(latestMessageId([msg(-1, "x", true)])).toBeUndefined();
  });
});
