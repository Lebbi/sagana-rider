/**
 * lib/riderChatApi.ts
 *
 * Delivery chat between the rider and the order's farmer or buyer
 * (RID-41, contract in .scratch/rid-delivery-chat/spec.md). Responses are
 * parsed here so screens get typed objects.
 */

import { isAxiosError } from "axios";

import api from "@/lib/api";
import type { ChatMessage } from "@/lib/chatMessages";

export type DeliveryChatWith = "buyer" | "farmer";

export interface DeliveryChat {
  id: number;
  orderId: number;
  orderCode: string;
  with: DeliveryChatWith;
  readOnly: boolean;
  otherUser: { id: number; name: string; profileImage: string | null };
}

export interface ChatMeta {
  readOnly: boolean;
}

export const isDeliveryChatWith = (value: unknown): value is DeliveryChatWith =>
  value === "buyer" || value === "farmer";

// The send response gives "Y-m-d H:i:s" in the backend's UTC; the list gives ISO.
const toIso = (value: unknown): string => {
  const text = String(value ?? "");
  return /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(text) ? `${text.replace(" ", "T")}Z` : text;
};

function parseMessage(raw: any): ChatMessage {
  return {
    id: Number(raw.id),
    senderId: Number(raw.sender_id ?? raw.sender?.id),
    body: String(raw.body ?? ""),
    createdAt: toIso(raw.created_at),
  };
}

/** The server's `error` text when the request was refused with 409, else null. */
export function conflictMessage(error: unknown): string | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null;
  const text = (error.response.data as { error?: unknown } | undefined)?.error;
  return typeof text === "string" && text ? text : "";
}

// POST /api/orders/:id/delivery-chat
export async function openDeliveryChat(
  orderId: number,
  withWhom: DeliveryChatWith,
): Promise<DeliveryChat> {
  const { data } = await api.post(`/orders/${orderId}/delivery-chat`, { with: withWhom });
  const c = data.data;
  return {
    id: Number(c.id),
    orderId: Number(c.order_id),
    orderCode: String(c.order_code ?? ""),
    with: isDeliveryChatWith(c.with) ? c.with : withWhom,
    readOnly: c.read_only === true,
    otherUser: {
      id: Number(c.other_user?.id),
      name: String(c.other_user?.name ?? ""),
      profileImage: c.other_user?.profile_image ?? null,
    },
  };
}

// GET /api/conversations/:id/messages?after_id=
export async function listMessages(
  conversationId: number,
  afterId?: number,
): Promise<{ messages: ChatMessage[]; meta: ChatMeta }> {
  const params = afterId ? { after_id: afterId } : {};
  const { data } = await api.get(`/conversations/${conversationId}/messages`, { params });
  const list: unknown[] = Array.isArray(data.data) ? data.data : [];
  return {
    messages: list.map(parseMessage),
    meta: { readOnly: data.meta?.read_only === true },
  };
}

// POST /api/conversations/:id/messages, responds { message, data }
export async function sendMessage(
  conversationId: number,
  body: string,
): Promise<ChatMessage> {
  const { data } = await api.post(`/conversations/${conversationId}/messages`, { body });
  return parseMessage(data.data);
}
