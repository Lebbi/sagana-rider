import type { GeoPoint, PreciseAddress, RiderOrder, RouteRequest } from "@/types/maps";

function usablePoint(addr: PreciseAddress): GeoPoint | null {
  if (addr.coordinatesMissing) return null;
  const { latitude, longitude } = addr;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

export type PreviewLeg = { to: "farmer" | "buyer"; request: RouteRequest };

/**
 * Pins and route legs for the Available Orders preview. The routing endpoint
 * only routes origin to destination (it ignores waypoints), so each leg is its
 * own request. A stop with no real map pin gets no pin and no leg, so the rider
 * is never sent to a placeholder location.
 */
export function getPreviewStops(order: RiderOrder, rider: GeoPoint | null) {
  const pickup = usablePoint(order.pickup.address);
  const delivery = usablePoint(order.delivery.address);
  const leg = (to: PreviewLeg["to"], origin: GeoPoint, destination: GeoPoint): PreviewLeg => ({
    to,
    request: { origin, destination, mode: "driving" },
  });

  const legs: PreviewLeg[] = [];
  if (pickup && rider) legs.push(leg("farmer", rider, pickup));
  if (pickup && delivery) legs.push(leg("buyer", pickup, delivery));

  return { pickup, delivery, legs };
}
