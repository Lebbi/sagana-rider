/**
 * lib/riderOutbox.ts
 *
 * Offline queue for delivery status updates (RID-44). When a pickup,
 * in-transit or delivered update can't reach the server (no signal, timeout,
 * gateway error), it is saved on the phone and sent later, in order.
 *
 * The list lives in AsyncStorage; proof photos are kept as files because a
 * base64 photo can be too big for one AsyncStorage row on Android.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";

import { getRiderOrderById, updateOrderStatus } from "@/lib/riderOrdersApi";
import type { DeliveryStatus } from "@/types/maps";

const KEY = "rider_outbox_v1";
const PHOTO_DIR = "rider-outbox";

export type OutboxEntry = {
  id: string;
  orderId: number;
  status: DeliveryStatus;
  /** File name under the outbox folder holding the base64 proof photo. */
  photoFile?: string;
  createdAt: number;
};

/** A rejected update, reported once so the screen can tell the rider. */
export type OutboxRejection = {
  orderId: number;
  status: DeliveryStatus;
  message?: string;
};

const RANK: DeliveryStatus[] = [
  "accepted",
  "to_pickup",
  "arrived_pickup",
  "picked_up",
  "to_delivery",
  "arrived_delivery",
  "delivered",
];

/** Worth retrying later: no response at all, a timeout, a gateway error, or a logged-out token. */
export function isRetryableError(e: unknown): boolean {
  const err = e as { response?: { status?: number } } | null;
  const status = err?.response?.status;
  if (status == null) return true;
  return status === 401 || status === 408 || status === 429 || status >= 502;
}

async function readList(): Promise<OutboxEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

let lock: Promise<unknown> = Promise.resolve();

/** Runs list read-modify-writes one at a time so a save during a send isn't lost. */
function changeList(fn: (list: OutboxEntry[]) => OutboxEntry[]): Promise<void> {
  const next = lock.then(async () => {
    const list = fn(await readList());
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  });
  lock = next.catch(() => {});
  return next;
}

function photoFile(name: string): File {
  return new File(Paths.document, PHOTO_DIR, name);
}

function deletePhoto(name?: string) {
  if (!name) return;
  try {
    const f = photoFile(name);
    if (f.exists) f.delete();
  } catch {}
}

export async function getOutbox(): Promise<OutboxEntry[]> {
  return readList();
}

export async function hasPendingFor(orderId: number): Promise<boolean> {
  return (await readList()).some((e) => e.orderId === orderId);
}

export async function enqueueStatus(
  orderId: number,
  status: DeliveryStatus,
  photoBase64?: string,
): Promise<void> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let photoName: string | undefined;
  if (photoBase64) {
    new Directory(Paths.document, PHOTO_DIR).create({ idempotent: true });
    photoName = `${id}.b64`;
    photoFile(photoName).write(photoBase64);
  }
  await changeList((list) => [
    ...list,
    { id, orderId, status, photoFile: photoName, createdAt: Date.now() },
  ]);
}

/**
 * Send now if possible, else save for later. Returns "queued" when saved.
 * Errors the server rejected (422 and the like) are thrown as before.
 * If this order already has saved updates, the new one waits behind them so
 * the server sees them in order.
 */
export async function sendOrQueueStatus(
  orderId: number,
  status: DeliveryStatus,
  photoBase64?: string,
): Promise<"sent" | "queued"> {
  if (await hasPendingFor(orderId)) {
    await enqueueStatus(orderId, status, photoBase64);
    void flushOutbox();
    return "queued";
  }
  try {
    await updateOrderStatus(orderId, status, photoBase64);
    return "sent";
  } catch (e) {
    if (!isRetryableError(e)) throw e;
    await enqueueStatus(orderId, status, photoBase64);
    return "queued";
  }
}

/** True when the server already has this order at or past `status`. */
async function serverAlreadyAt(orderId: number, status: DeliveryStatus) {
  try {
    const order = await getRiderOrderById(orderId);
    return RANK.indexOf(order.status) >= RANK.indexOf(status);
  } catch {
    return false;
  }
}

let flushing: Promise<FlushResult> | null = null;

export type FlushResult = { sent: number; rejected: OutboxRejection[]; left: number };

/**
 * Send saved updates oldest first. Stops at the first one that still can't
 * reach the server. A rejected one is dropped, along with the rest of that
 * order's updates; if the server already has the order at that step (the
 * first try got through but its answer was lost), it is dropped silently.
 */
export function flushOutbox(): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    const result: FlushResult = { sent: 0, rejected: [], left: 0 };
    const dropped = new Set<number>();
    for (;;) {
      await lock;
      const entry = (await readList())[0];
      if (!entry) break;
      if (!dropped.has(entry.orderId)) {
        let photo: string | undefined;
        if (entry.photoFile) {
          try {
            photo = await photoFile(entry.photoFile).text();
          } catch {
            photo = undefined; // photo lost on the phone; still send the status
          }
        }
        try {
          await updateOrderStatus(entry.orderId, entry.status, photo);
          result.sent++;
        } catch (e) {
          if (isRetryableError(e)) break;
          dropped.add(entry.orderId);
          if (!(await serverAlreadyAt(entry.orderId, entry.status))) {
            const msg = (e as { response?: { data?: { message?: string } } })
              ?.response?.data?.message;
            result.rejected.push({ orderId: entry.orderId, status: entry.status, message: msg });
          }
        }
      }
      deletePhoto(entry.photoFile);
      await changeList((list) => list.filter((e) => e.id !== entry.id));
    }
    result.left = (await readList()).length;
    return result;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
