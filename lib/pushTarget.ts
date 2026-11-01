export type PushData = {
  type?: string;
  order_id?: unknown;
  status?: string;
};

export function pushTarget(data?: PushData | null): string {
  const orderId = String(data?.order_id);
  if (data?.status === "cancelled" || !/^[1-9]\d*$/.test(orderId)) return "/tabs";
  return `/rider/orders/${orderId}`;
}
