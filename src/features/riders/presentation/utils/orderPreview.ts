import type { GeoPoint, PreciseAddress, RiderOrder, RouteRequest } from "@/types/maps";

function usablePoint(addr: PreciseAddress): GeoPoint | null {
  if (addr.coordinatesMissing) return null;
  const { latitude, longitude } = addr;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

/**
 * Pins and the route request for the Available Orders preview. A stop with no
 * real map pin gets no pin and no route leg, so the rider is never sent to a
 * placeholder location.
 */
export function getPreviewStops(order: RiderOrder, rider: GeoPoint | null) {
  const pickup = usablePoint(order.pickup.address);
  const delivery = usablePoint(order.delivery.address);

  let request: RouteRequest | null = null;
  if (pickup && delivery) {
    request = rider
      ? { origin: rider, waypoints: [pickup], destination: delivery, mode: "driving" }
      : { origin: pickup, destination: delivery, mode: "driving" };
  } else if (pickup && rider) {
    request = { origin: rider, destination: pickup, mode: "driving" };
  }

  return { pickup, delivery, request };
}
