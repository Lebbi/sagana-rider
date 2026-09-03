/**
 * types/maps.ts
 *
 * Shared types for all map, routing, delivery, and tracking features.
 * This is the single source of truth for both frontend and backend.
 * The backend dev's API responses must match these interfaces exactly.
 *
 * @see docs/maps-implementation-plan.md
 */

// ============================================================
// GEO POINTS
// ============================================================

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoPolygon {
  points: GeoPoint[];
  type: "danger" | "flood" | "construction";
  label?: string;
}

// ============================================================
// ADDRESS (upgraded — adds lat/lng + landmark note)
// ============================================================

export interface PreciseAddress {
  latitude: number;
  longitude: number;
  street: string;
  barangay: string;
  city: string;
  province: string;
  postalCode: string | null;
  /** "Blue gate, beside Aling Nena's sari-sari store, 2nd floor" */
  landmarkNote: string;
  /** "Home", "Work", "Farm" */
  label?: string;
  recipientName: string;
  recipientPhone: string;
}

// ============================================================
// ROUTING (OSRM/Google Directions response)
// ============================================================

export interface RouteRequest {
  origin: GeoPoint;
  destination: GeoPoint;
  /** For multi-stop (pasabay) */
  waypoints?: GeoPoint[];
  mode: "driving";
  alternatives?: boolean;
  /** Admin-defined danger/flood zones */
  avoidZones?: GeoPolygon[];
}

export interface RouteResponse {
  /** Decoded route coordinates */
  polyline: GeoPoint[];
  /** meters */
  totalDistance: number;
  /** seconds */
  totalDuration: number;
  steps: RouteStep[];
  /** For multi-stop, one leg per segment */
  legs: RouteLeg[];
}

export interface RouteStep {
  /** "Turn left onto Mabini Street" */
  instruction: string;
  maneuver: ManeuverType;
  /** meters */
  distance: number;
  /** seconds */
  duration: number;
  /** road name */
  name: string;
  startCoord: GeoPoint;
  endCoord: GeoPoint;
}

export type ManeuverType =
  | "turn-left"
  | "turn-right"
  | "turn-slight-left"
  | "turn-slight-right"
  | "turn-sharp-left"
  | "turn-sharp-right"
  | "straight"
  | "uturn"
  | "arrive"
  | "depart"
  | "roundabout"
  | "merge"
  | "fork";

export interface RouteLeg {
  startCoord: GeoPoint;
  endCoord: GeoPoint;
  /** meters */
  distance: number;
  /** seconds */
  duration: number;
  steps: RouteStep[];
}

// ============================================================
// RIDER LOCATION (GPS + heading)
// ============================================================

export interface RiderLocation {
  riderId: number;
  orderId: number;
  latitude: number;
  longitude: number;
  /** degrees from north (0-360) */
  heading: number | null;
  /** m/s */
  speed: number | null;
  /** meters (GPS accuracy) */
  accuracy: number | null;
  /** ISO 8601 */
  timestamp: string;
}

// ============================================================
// DELIVERY STATUS
// ============================================================

export type DeliveryStatus =
  | "searching"
  | "accepted"
  | "to_pickup"
  | "arrived_pickup"
  | "picked_up"
  | "to_delivery"
  | "arrived_delivery"
  | "delivered"
  | "cancelled";

export interface DeliveryStatusEvent {
  orderId: number;
  status: DeliveryStatus;
  timestamp: string;
  riderId?: number;
  riderName?: string;
  riderPhoto?: string;
  riderPhone?: string;
  etaMinutes?: number;
  currentLocation?: GeoPoint;
}

// ============================================================
// RIDER ORDER (with coordinates for navigation)
// ============================================================

export interface RiderOrder {
  orderId: number;
  /** "#SG-9900" */
  orderNumber: string;
  status: DeliveryStatus;
  createdAt: string;
  shippingFee: number;

  // Pickup (farmer)
  pickup: {
    farmerId: number;
    farmerName: string;
    farmerPhone: string;
    farmerPhoto?: string;
    address: PreciseAddress;
    items: OrderItem[];
  };

  // Delivery (buyer)
  delivery: {
    buyerId: number;
    buyerName: string;
    buyerPhone: string;
    buyerPhoto?: string;
    address: PreciseAddress;
    noteToRider?: string;
  };

  // Payment
  paymentMethod: string;
  /** Cash on delivery amount */
  codAmount?: number;
}

export interface OrderItem {
  productId: number;
  productName: string;
  variationName?: string;
  quantity: number;
  /** "kg", "sack", "pieces" */
  unit: string;
  weightKg?: number;
}

// ============================================================
// PASABAY (Multi-drop)
// ============================================================

export interface PasabayBatch {
  batchId: number;
  riderId: number;
  orders: RiderOrder[];
  optimizedStops: OptimizedStop[];
  /** meters */
  totalDistance: number;
  /** seconds */
  totalDuration: number;
  totalEarnings: number;
}

export interface OptimizedStop {
  /** 1, 2, 3... */
  stopNumber: number;
  orderId: number;
  type: "pickup" | "delivery";
  address: PreciseAddress;
  contactName: string;
  contactPhone: string;
  items: OrderItem[];
  legToNext?: {
    /** meters */
    distance: number;
    /** seconds */
    duration: number;
    polyline: GeoPoint[];
  };
}

export interface OptimizeRouteRequest {
  riderStart: GeoPoint;
  orders: {
    orderId: number;
    pickup: GeoPoint;
    delivery: GeoPoint;
  }[];
  constraints: {
    /** Default: 6 (3 orders × 2 stops each) */
    maxStops: number;
    /** Default: 30 */
    maxDistanceKm: number;
    /** Default: 60 */
    maxDurationMinutes: number;
  };
}

export interface OptimizeRouteResponse {
  batchId: number;
  optimizedStops: OptimizedStop[];
  /** meters */
  totalDistance: number;
  /** seconds */
  totalDuration: number;
  /** Full route polyline through all stops */
  polyline: GeoPoint[];
}

// ============================================================
// SNAP TO ROAD
// ============================================================

export interface SnapToRoadRequest {
  points: GeoPoint[];
}

export interface SnapToRoadResponse {
  snappedPoints: GeoPoint[];
}

// ============================================================
// WEBSOCKET EVENTS
// ============================================================

export interface WsRiderLocationUpdate {
  orderId: number;
  riderId: number;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  etaMinutes: number;
  status: DeliveryStatus;
  timestamp: string;
}

export interface WsDeliveryStatusChanged {
  orderId: number;
  status: DeliveryStatus;
  riderId: number;
  riderName: string;
  riderPhoto?: string;
  timestamp: string;
  etaMinutes?: number;
}

// ============================================================
// RIDER SETTINGS (auto-accept toggle)
// ============================================================

export interface RiderSettings {
  autoAccept: boolean;
  isOnline: boolean;
  maxPasabayStops: number;
}

export interface UpdateRiderSettings {
  autoAccept?: boolean;
  isOnline?: boolean;
  maxPasabayStops?: number;
}
