import type { IconName } from "@/constants/IconTheme";
import type { TextKey } from "@/lib/i18n";

export type EmptyState = {
  icon: IconName;
  title: TextKey;
  body: TextKey;
  /** The next step; every action today leads to Home, where orders come in. */
  action?: TextKey;
};

export type OrdersTab = "All" | "New" | "Processing" | "Delivered";

const NO_ORDERS_YET: EmptyState = {
  icon: "truckDelivery",
  title: "empty.ordersNoneTitle",
  body: "empty.ordersNoneBody",
  action: "empty.findOrders",
};

const ORDERS_TAB_EMPTY: Record<Exclude<OrdersTab, "All">, EmptyState> = {
  New: {
    icon: "trayFull",
    title: "empty.ordersNewTitle",
    body: "empty.ordersNewBody",
    action: "empty.findOrders",
  },
  Processing: {
    icon: "package",
    title: "empty.ordersProcessingTitle",
    body: "empty.ordersProcessingBody",
  },
  Delivered: {
    icon: "checkCircle",
    title: "empty.ordersDeliveredTitle",
    body: "empty.ordersDeliveredBody",
  },
};

/** A rider with no orders at all sees how to get one; otherwise the tab explains itself. */
export function ordersEmptyState(tab: OrdersTab, hasAnyOrders: boolean): EmptyState {
  if (!hasAnyOrders || tab === "All") return NO_ORDERS_YET;
  return ORDERS_TAB_EMPTY[tab];
}

export const WALLET_NO_EARNINGS: EmptyState = {
  icon: "walletOutline",
  title: "empty.walletTitle",
  body: "empty.walletBody",
  action: "empty.findOrders",
};

/** Home's available-orders card: off duty, the fix is the switch above it. */
export function homeAvailableEmptyState(isOnDuty: boolean): EmptyState {
  return isOnDuty
    ? { icon: "search", title: "empty.homeWaitingTitle", body: "empty.homeWaitingBody" }
    : { icon: "directionsBike", title: "empty.homeOffDutyTitle", body: "empty.homeOffDutyBody" };
}
