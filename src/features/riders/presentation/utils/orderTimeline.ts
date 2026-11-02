import type { TextKey } from "@/lib/i18n";
import type { DeliveryStatus } from "@/types/maps";

export const STATUS_TIMELINE: { status: DeliveryStatus; label: TextKey; icon: string }[] = [
  { status: "searching", label: "status.searching", icon: "radio-button-unchecked" },
  { status: "accepted", label: "status.accepted", icon: "check-circle" },
  { status: "to_pickup", label: "status.toPickup", icon: "local-shipping" },
  { status: "arrived_pickup", label: "status.arrivedPickup", icon: "location-on" },
  { status: "picked_up", label: "status.pickedUp", icon: "inventory-2" },
  { status: "to_delivery", label: "status.toDelivery", icon: "local-shipping" },
  { status: "arrived_delivery", label: "status.arrivedDelivery", icon: "location-on" },
  { status: "delivered", label: "status.delivered", icon: "check-circle" },
  { status: "cancelled", label: "status.cancelled", icon: "cancel" },
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
