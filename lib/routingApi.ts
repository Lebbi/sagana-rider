/**
 * lib/routingApi.ts
 *
 * Routing API client — handles directions, route optimization (pasabay),
 * and snap-to-road.
 *
 * DEVELOPMENT MODE: Calls the OSRM demo server directly
 * (https://router.project-osrm.org) — free, no API key, rate-limited (1 req/sec).
 *
 * PRODUCTION MODE: Calls the Laravel backend proxy
 * (POST /api/routing/directions) which hides the OSRM server URL and
 * allows caching + avoid-zones + OR-Tools optimization.
 *
 * Flip USE_BACKEND_PROXY to true when the backend endpoints are ready.
 *
 * @see docs/maps-implementation-plan.md
 */

import api from "@/lib/api";
import type {
    GeoPoint,
    ManeuverType,
    OptimizeRouteRequest,
    OptimizeRouteResponse,
    OptimizedStop,
    RouteRequest,
    RouteResponse,
    RouteStep,
    SnapToRoadRequest,
    SnapToRoadResponse,
} from "@/types/maps";

/**
 * When false: calls OSRM demo server directly (for frontend development).
 * When true: calls Laravel backend proxy (for production / when backend is ready).
 */
const USE_BACKEND_PROXY = true;

/**
 * OSRM demo server URL (free, rate-limited, for development only).
 * In production, the backend proxies to a self-hosted OSRM instance.
 */
const OSRM_DEMO_URL = "https://router.project-osrm.org";

// ============================================================
// POST /api/routing/directions (or OSRM demo directly)
// ============================================================

export async function getDirections(req: RouteRequest): Promise<RouteResponse> {
  if (USE_BACKEND_PROXY) {
    const { data } = await api.post<RouteResponse>("/routing/directions", req);
    return data;
  }
  return getDirectionsFromOSRM(req);
}

// ============================================================
// POST /api/routing/optimize (Pasabay)
// ============================================================

export async function optimizeRoute(
  req: OptimizeRouteRequest,
): Promise<OptimizeRouteResponse> {
  if (USE_BACKEND_PROXY) {
    const { data } = await api.post<OptimizeRouteResponse>(
      "/routing/optimize",
      req,
    );
    return data;
  }
  return mockOptimizeRoute(req);
}

// ============================================================
// POST /api/routing/snap-to-road
// ============================================================

export async function snapToRoad(
  req: SnapToRoadRequest,
): Promise<SnapToRoadResponse> {
  if (USE_BACKEND_PROXY) {
    const { data } = await api.post<SnapToRoadResponse>(
      "/routing/snap-to-road",
      req,
    );
    return data;
  }
  return snapToRoadViaOSRM(req);
}

// ============================================================
// OSRM demo server implementation
// ============================================================

async function getDirectionsFromOSRM(
  req: RouteRequest,
): Promise<RouteResponse> {
  // OSRM expects [lng,lat] order
  const origin = `${req.origin.longitude},${req.origin.latitude}`;
  const dest = `${req.destination.longitude},${req.destination.latitude}`;

  const url = `${OSRM_DEMO_URL}/route/v1/driving/${origin};${dest}?overview=full&geometries=geojson&steps=true`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OSRM directions failed: ${response.status}`);
  }

  const osrmData = await response.json();
  if (!osrmData.routes || osrmData.routes.length === 0) {
    throw new Error("OSRM returned no routes");
  }

  const route = osrmData.routes[0];

  return {
    polyline: extractPolyline(route),
    totalDistance: route.distance,
    totalDuration: route.duration,
    steps: extractSteps(route),
    legs: extractLegs(route),
  };
}

async function snapToRoadViaOSRM(
  req: SnapToRoadRequest,
): Promise<SnapToRoadResponse> {
  const snappedPoints: GeoPoint[] = [];

  for (const point of req.points) {
    const coord = `${point.longitude},${point.latitude}`;
    const url = `${OSRM_DEMO_URL}/nearest/v1/driving/${coord}?number=1`;

    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();
      if (data.waypoints && data.waypoints[0]) {
        const loc = data.waypoints[0].location;
        snappedPoints.push({
          latitude: loc[1],
          longitude: loc[0],
        });
      } else {
        // Fallback: return original point if snap fails
        snappedPoints.push(point);
      }
    } catch {
      // Fallback: return original point on error
      snappedPoints.push(point);
    }
  }

  return { snappedPoints };
}

// ============================================================
// OSRM response mappers
// ============================================================

function extractPolyline(route: any): GeoPoint[] {
  const coordinates: number[][] = route.geometry?.coordinates ?? [];
  return coordinates.map((coord) => ({
    latitude: coord[1],
    longitude: coord[0],
  }));
}

function extractSteps(route: any): RouteStep[] {
  const steps: RouteStep[] = [];
  const legs = route.legs ?? [];

  for (const leg of legs) {
    for (const step of leg.steps ?? []) {
      const maneuver = step.maneuver?.type ?? "continue";
      const modifier = step.maneuver?.modifier ?? "";

      const maneuverType = mapManeuverType(maneuver, modifier);

      const coords: number[][] = step.geometry?.coordinates ?? [];
      const startCoord: GeoPoint = coords[0]
        ? { latitude: coords[0][1], longitude: coords[0][0] }
        : { latitude: 0, longitude: 0 };
      const endCoord: GeoPoint = coords[coords.length - 1]
        ? {
            latitude: coords[coords.length - 1][1],
            longitude: coords[coords.length - 1][0],
          }
        : startCoord;

      steps.push({
        instruction: formatInstruction(step, maneuverType),
        maneuver: maneuverType,
        distance: step.distance ?? 0,
        duration: step.duration ?? 0,
        name: step.name ?? "",
        startCoord,
        endCoord,
      });
    }
  }

  return steps;
}

function extractLegs(route: any): RouteResponse["legs"] {
  const legs = route.legs ?? [];
  return legs.map((leg: any) => ({
    startCoord: {
      latitude: leg.steps?.[0]?.geometry?.coordinates?.[0]?.[1] ?? 0,
      longitude: leg.steps?.[0]?.geometry?.coordinates?.[0]?.[0] ?? 0,
    },
    endCoord: {
      latitude:
        leg.steps?.[leg.steps.length - 1]?.geometry?.coordinates?.slice(
          -1,
        )[0]?.[1] ?? 0,
      longitude:
        leg.steps?.[leg.steps.length - 1]?.geometry?.coordinates?.slice(
          -1,
        )[0]?.[0] ?? 0,
    },
    distance: leg.distance ?? 0,
    duration: leg.duration ?? 0,
    steps: [],
  }));
}

function mapManeuverType(type: string, modifier: string): ManeuverType {
  if (type === "depart") return "depart";
  if (type === "arrive") return "arrive";
  if (type === "turn" || type === "new name") {
    if (modifier === "left") return "turn-left";
    if (modifier === "right") return "turn-right";
    if (modifier === "slight left") return "turn-slight-left";
    if (modifier === "slight right") return "turn-slight-right";
    if (modifier === "sharp left") return "turn-sharp-left";
    if (modifier === "sharp right") return "turn-sharp-right";
  }
  if (type === "continue") {
    if (modifier === "left") return "turn-slight-left";
    if (modifier === "right") return "turn-slight-right";
    return "straight";
  }
  if (type === "roundabout" || type === "rotary") return "roundabout";
  if (type === "merge") return "merge";
  if (type === "fork") return "fork";
  if (type === "on ramp") return "merge";
  if (type === "off ramp") return "merge";
  if (type === "end of road") {
    if (modifier === "left") return "turn-left";
    if (modifier === "right") return "turn-right";
  }
  if (type === "uturn") return "uturn";
  return "straight";
}

function formatInstruction(step: any, maneuverType: ManeuverType): string {
  const name = step.name ?? "";
  const type = step.maneuver?.type ?? "";

  if (maneuverType === "arrive") {
    return "Arrive at your destination";
  }
  if (maneuverType === "depart") {
    return name ? `Head toward ${name}` : "Start driving";
  }
  if (maneuverType === "turn-left") {
    return name ? `Turn left onto ${name}` : "Turn left";
  }
  if (maneuverType === "turn-right") {
    return name ? `Turn right onto ${name}` : "Turn right";
  }
  if (maneuverType === "turn-slight-left") {
    return name ? `Keep slightly left onto ${name}` : "Keep slightly left";
  }
  if (maneuverType === "turn-slight-right") {
    return name ? `Keep slightly right onto ${name}` : "Keep slightly right";
  }
  if (maneuverType === "turn-sharp-left") {
    return name ? `Sharp left onto ${name}` : "Sharp left";
  }
  if (maneuverType === "turn-sharp-right") {
    return name ? `Sharp right onto ${name}` : "Sharp right";
  }
  if (maneuverType === "roundabout") {
    return name ? `Enter roundabout and exit onto ${name}` : "Enter roundabout";
  }
  if (maneuverType === "merge") {
    return name ? `Merge onto ${name}` : "Merge";
  }
  if (maneuverType === "fork") {
    return name ? `Stay on ${name}` : "Stay on current road";
  }
  if (maneuverType === "uturn") {
    return "Make a U-turn";
  }
  return name ? `Continue on ${name}` : "Continue";
}

// ============================================================
// Mock pasabay optimization (for frontend development)
// ============================================================

function mockOptimizeRoute(req: OptimizeRouteRequest): OptimizeRouteResponse {
  const stops: OptimizedStop[] = [];
  let stopNum = 1;

  // All pickups first, then all deliveries (simple heuristic)
  req.orders.forEach((order) => {
    stops.push({
      stopNumber: stopNum++,
      orderId: order.orderId,
      type: "pickup",
      address: {
        latitude: order.pickup.latitude,
        longitude: order.pickup.longitude,
        street: "",
        barangay: "",
        city: "",
        province: "Pampanga",
        postalCode: null,
        landmarkNote: "",
        recipientName: `Farmer ${order.orderId}`,
        recipientPhone: "+63 991 123 4567",
      },
      contactName: `Farmer ${order.orderId}`,
      contactPhone: "+63 991 123 4567",
      items: [],
    });
  });

  req.orders.forEach((order) => {
    stops.push({
      stopNumber: stopNum++,
      orderId: order.orderId,
      type: "delivery",
      address: {
        latitude: order.delivery.latitude,
        longitude: order.delivery.longitude,
        street: "",
        barangay: "",
        city: "",
        province: "Pampanga",
        postalCode: null,
        landmarkNote: "",
        recipientName: `Buyer ${order.orderId}`,
        recipientPhone: "+63 917 765 4321",
      },
      contactName: `Buyer ${order.orderId}`,
      contactPhone: "+63 917 765 4321",
      items: [],
    });
  });

  // Build a simple polyline through all stops
  const polyline: GeoPoint[] = [
    req.riderStart,
    ...req.orders.flatMap((o) => [o.pickup, o.delivery]),
  ];

  return {
    batchId: Date.now(),
    optimizedStops: stops,
    totalDistance: 15000,
    totalDuration: 3300,
    polyline,
  };
}
