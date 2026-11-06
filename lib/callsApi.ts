import api from "@/lib/api";

export type Callee = "farmer" | "buyer";

/** What the server returns for one person joining one call channel. */
export type CallCredentials = {
  app_id: string;
  channel: string;
  uid: number;
  token: string;
  expires_in: number;
};

/** Rings the callee's open app and returns the rider's token. */
export async function startCall(orderId: number, callee: Callee): Promise<CallCredentials> {
  const { data } = await api.post<CallCredentials>(`/calls/orders/${orderId}/start`, { callee });
  return data;
}

export async function refreshCallToken(orderId: number, callee: Callee): Promise<CallCredentials> {
  const { data } = await api.post<CallCredentials>(`/calls/orders/${orderId}/token`, { callee });
  return data;
}

/** Best effort: tells the other side's open app to stop ringing or leave. */
export function endCall(orderId: number, callee: Callee): void {
  api.post(`/calls/orders/${orderId}/end`, { callee }).catch(() => {});
}
