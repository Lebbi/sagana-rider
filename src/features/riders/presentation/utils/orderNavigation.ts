import type { DeliveryStatus } from "@/types/maps";

export type OrderCardRoute = {
  pathname: string;
  params?: { orderId: string };
};

/** Active deliveries resume the live screen; every other order opens its detail screen. */
export function getOrderCardRoute(order: {
  orderId: number;
  status: DeliveryStatus;
  isActive: boolean;
}): OrderCardRoute {
  if (order.isActive) {
    return {
      pathname: "/tabs/ActiveDeliveryPage",
      params: { orderId: String(order.orderId) },
    };
  }
  return { pathname: `/rider/orders/${order.orderId}` };
}
