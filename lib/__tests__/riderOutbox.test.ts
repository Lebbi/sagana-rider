import { beforeEach, expect, jest, test } from "@jest/globals";

import {
  enqueueStatus,
  flushOutbox,
  getOutbox,
  isRetryableError,
  sendOrQueueStatus,
} from "@/lib/riderOutbox";
import { getRiderOrderById, updateOrderStatus } from "@/lib/riderOrdersApi";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// In-memory stand-in for the phone's mockFiles.
const mockFiles = new Map<string, string>();
jest.mock("expo-file-system", () => {
  class File {
    path: string;
    constructor(...parts: unknown[]) {
      this.path = parts.map(String).join("/");
    }
    get exists() {
      return mockFiles.has(this.path);
    }
    write(s: string) {
      mockFiles.set(this.path, s);
    }
    async text() {
      return mockFiles.get(this.path) ?? "";
    }
    delete() {
      mockFiles.delete(this.path);
    }
  }
  class Directory {
    create() {}
  }
  return { File, Directory, Paths: { document: "doc" } };
});

jest.mock("@/lib/riderOrdersApi", () => ({
  updateOrderStatus: jest.fn(),
  getRiderOrderById: jest.fn(),
}));

const update = jest.mocked(updateOrderStatus);
const getOrder = jest.mocked(getRiderOrderById);
const offline = Object.assign(new Error("Network Error"), { response: undefined });
const rejected = (message: string) =>
  Object.assign(new Error("422"), { response: { status: 422, data: { message } } });

beforeEach(async () => {
  update.mockReset();
  getOrder.mockReset();
  mockFiles.clear();
  await (require("@react-native-async-storage/async-storage") as { clear: () => Promise<void> }).clear();
});

test("retryable: no response, timeout, gateway and 401; not 422 or 404", () => {
  expect(isRetryableError(offline)).toBe(true);
  expect(isRetryableError({ response: { status: 503 } })).toBe(true);
  expect(isRetryableError({ response: { status: 401 } })).toBe(true);
  expect(isRetryableError({ response: { status: 422 } })).toBe(false);
  expect(isRetryableError({ response: { status: 404 } })).toBe(false);
});

test("offline update is saved with its photo and sent later in order", async () => {
  update.mockRejectedValueOnce(offline);
  expect(await sendOrQueueStatus(7, "picked_up", "PHOTO")).toBe("queued");
  // A later update for the same order waits behind it; the send it starts is still offline.
  update.mockRejectedValue(offline);
  expect(await sendOrQueueStatus(7, "delivered", "PHOTO2")).toBe("queued");
  await flushOutbox();
  expect((await getOutbox()).map((e) => e.status)).toEqual(["picked_up", "delivered"]);

  update.mockReset().mockResolvedValue({ success: true });
  const res = await flushOutbox();
  expect(res).toEqual({ sent: 2, rejected: [], left: 0 });
  expect(update.mock.calls).toEqual([
    [7, "picked_up", "PHOTO"],
    [7, "delivered", "PHOTO2"],
  ]);
  expect(mockFiles.size).toBe(0);
});

test("flush stops at the first update that still can't get through", async () => {
  await enqueueStatus(1, "picked_up");
  await enqueueStatus(2, "picked_up");
  update.mockRejectedValue(offline);
  expect(await flushOutbox()).toEqual({ sent: 0, rejected: [], left: 2 });
});

test("a rejected update is reported and the rest of that order is dropped", async () => {
  await enqueueStatus(1, "picked_up");
  await enqueueStatus(1, "delivered");
  await enqueueStatus(2, "delivered");
  update.mockRejectedValueOnce(rejected("Not ready")).mockResolvedValue({ success: true });
  getOrder.mockResolvedValue({ status: "accepted" } as never);
  const res = await flushOutbox();
  expect(res.rejected).toEqual([{ orderId: 1, status: "picked_up", message: "Not ready" }]);
  expect(update.mock.calls).toEqual([
    [1, "picked_up", undefined],
    [2, "delivered", undefined],
  ]);
  expect(res.left).toBe(0);
});

test("a 422 for a step the server already has (lost answer) is dropped silently", async () => {
  await enqueueStatus(1, "picked_up");
  update.mockRejectedValueOnce(rejected("Invalid status transition"));
  getOrder.mockResolvedValue({ status: "to_delivery" } as never);
  expect(await flushOutbox()).toEqual({ sent: 0, rejected: [], left: 0 });
});

test("an update saved during a flush is not lost", async () => {
  await enqueueStatus(1, "picked_up");
  let release!: () => void;
  update.mockImplementationOnce(() => new Promise((r) => (release = () => r({ success: true }))));
  update.mockRejectedValue(offline);
  const flushing = flushOutbox();
  await new Promise((r) => setTimeout(r, 0));
  await enqueueStatus(1, "delivered");
  release();
  await flushing;
  expect((await getOutbox()).map((e) => e.status)).toEqual(["delivered"]);
});
