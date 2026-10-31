import type { DeliveryStatus } from "@/types/maps";

export const STATUS_TIMELINE: { status: DeliveryStatus; label: string; icon: string }[] = [
  { status: "searching", label: "Searching for Rider", icon: "radio-button-unchecked" },
  { status: "accepted", label: "Order Accepted", icon: "check-circle" },
  { status: "to_pickup", label: "En Route to Pickup", icon: "local-shipping" },
  { status: "arrived_pickup", label: "Arrived at Pickup", icon: "location-on" },
  { status: "picked_up", label: "Items Collected", icon: "inventory-2" },
  { status: "to_delivery", label: "En Route to Delivery", icon: "local-shipping" },
  { status: "arrived_delivery", label: "Arrived at Delivery", icon: "location-on" },
  { status: "delivered", label: "Delivered", icon: "check-circle" },
  { status: "cancelled", label: "Cancelled", icon: "cancel" },
];

export type TimelineStepState = "done" | "current" | "future";

/**
 * One state per STATUS_TIMELINE step. Cancelled is terminal: the progress the
 * order made before cancelling is unknown, so no earlier step is marked done.
 */
export function getTimelineStepStates(status: string): TimelineStepState[] {
  const currentIndex = STATUS_TIMELINE.findIndex((s) => s.status === status);
  const isCancelled = status === "cancelled";
  return STATUS_TIMELINE.map((_, index) => {
    if (currentIndex === -1) return "future";
    if (index === currentIndex) return "current";
    if (!isCancelled && index < currentIndex) return "done";
    return "future";
  });
}
