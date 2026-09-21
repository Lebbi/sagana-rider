/**
 * src/features/riders/presentation/hooks/useRiderNavigation.ts
 *
 * The brain of the rider navigation experience.
 * Manages GPS tracking, route fetching, snap-to-road, step tracking,
 * voice triggers, auto-reroute, and location broadcasting.
 *
 * @see docs/maps-implementation-plan.md
 */

import { broadcastRiderLocation } from "@/lib/riderOrdersApi";
import { getDirections } from "@/lib/routingApi";
import type { GeoPoint, RouteResponse, RouteStep } from "@/types/maps";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================
// Types
// ============================================================

export interface UseRiderNavigationParams {
  orderId: number;
  destination: GeoPoint;
  destinationType: "pickup" | "delivery";
}

export interface UseRiderNavigationReturn {
  // GPS
  riderLocation: GeoPoint | null;
  riderHeading: number | null;
  gpsAccuracy: number | null;
  gpsPermissionGranted: boolean;

  // Route
  route: RouteResponse | null;
  currentStep: RouteStep | null;
  nextStep: RouteStep | null;
  distanceToNextStep: number; // meters
  etaMinutes: number;
  isRerouting: boolean;
  isLoadingRoute: boolean;

  // Actions
  startNavigation: () => void;
  stopNavigation: () => void;
  reroute: () => void;
}

// ============================================================
// Constants
// ============================================================

const GPS_UPDATE_INTERVAL = 3000; // 3 seconds
const REROUTE_THRESHOLD = 50; // meters off route before rerouting
const ARRIVAL_THRESHOLD = 50; // meters to destination = arrived
const LOCATION_TASK_NAME = "rider-navigation-tracking";

// ============================================================
// Hook
// ============================================================

export function useRiderNavigation(
  params: UseRiderNavigationParams,
): UseRiderNavigationReturn {
  const { orderId, destination, destinationType } = params;

  const [riderLocation, setRiderLocation] = useState<GeoPoint | null>(null);
  const [riderHeading, setRiderHeading] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsPermissionGranted, setGpsPermissionGranted] = useState(false);

  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [distanceToNextStep, setDistanceToNextStep] = useState(0);
  const [isRerouting, setIsRerouting] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(
    null,
  );
  const isNavigatingRef = useRef(false);
  const lastBroadcastRef = useRef(0);

  // ----------------------------------------------------------
  // Request GPS permission
  // ----------------------------------------------------------

  const requestLocationPermission = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === "granted";
      setGpsPermissionGranted(granted);

      if (!granted && __DEV__) {
        console.warn("[useRiderNavigation] Location permission denied");
      }

      return granted;
    } catch (e) {
      if (__DEV__) {
        console.error("[useRiderNavigation] Error requesting permission:", e);
      }
      return false;
    }
  }, []);

  // ----------------------------------------------------------
  // Fetch route from OSRM
  // ----------------------------------------------------------

  const fetchRoute = useCallback(
    async (origin: GeoPoint) => {
      if (!destination) return;
      setIsLoadingRoute(true);
      try {
        const response = await getDirections({
          origin,
          destination,
          mode: "driving",
        });
        setRoute(response);
        setCurrentStepIndex(0);
        setDistanceToNextStep(response.steps[0]?.distance ?? 0);
      } catch (e) {
        // OSRM demo server is rate-limited and may return 502/503.
        // Non-blocking — the map still shows, just without a route line.
        if (__DEV__) {
          console.warn("[useRiderNavigation] Route fetch failed (non-blocking):", e?.response?.status ?? e?.message);
        }
      } finally {
        setIsLoadingRoute(false);
      }
    },
    [destination],
  );

  // ----------------------------------------------------------
  // Start GPS tracking + navigation
  // ----------------------------------------------------------

  const startNavigation = useCallback(async () => {
    const granted = await requestLocationPermission();
    if (!granted) return;

    isNavigatingRef.current = true;

    try {
      // Get initial position
      const initialPos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const initialLocation: GeoPoint = {
        latitude: initialPos.coords.latitude,
        longitude: initialPos.coords.longitude,
      };

      setRiderLocation(initialLocation);
      setRiderHeading(initialPos.coords.heading ?? null);
      setGpsAccuracy(initialPos.coords.accuracy ?? null);

      // Fetch route to destination
      await fetchRoute(initialLocation);

      // Start watching position
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: GPS_UPDATE_INTERVAL,
          distanceInterval: 5,
        },
        (location) => {
          if (!isNavigatingRef.current) return;

          const newLocation: GeoPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          setRiderLocation(newLocation);
          setRiderHeading(location.coords.heading ?? null);
          setGpsAccuracy(location.coords.accuracy ?? null);

          // Broadcast to backend (throttled)
          const now = Date.now();
          if (now - lastBroadcastRef.current >= GPS_UPDATE_INTERVAL) {
            lastBroadcastRef.current = now;
            broadcastRiderLocation(
              orderId,
              newLocation.latitude,
              newLocation.longitude,
              location.coords.heading ?? null,
              location.coords.speed ?? null,
            ).catch(() => {
              // Silent fail — broadcasting is best-effort
            });
          }

          // Track step progress
          updateStepProgress(newLocation);
        },
      );

      locationSubscriptionRef.current = subscription;
    } catch (e) {
      if (__DEV__) {
        console.error("[useRiderNavigation] Error starting navigation:", e);
      }
    }
  }, [requestLocationPermission, fetchRoute, orderId]);

  // ----------------------------------------------------------
  // Stop navigation
  // ----------------------------------------------------------

  const stopNavigation = useCallback(() => {
    isNavigatingRef.current = false;
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
  }, []);

  // ----------------------------------------------------------
  // Manual reroute
  // ----------------------------------------------------------

  const reroute = useCallback(async () => {
    if (!riderLocation) return;
    setIsRerouting(true);
    await fetchRoute(riderLocation);
    setIsRerouting(false);
  }, [riderLocation, fetchRoute]);

  // ----------------------------------------------------------
  // Track step progress + auto-reroute
  // ----------------------------------------------------------

  const updateStepProgress = useCallback(
    (currentPos: GeoPoint) => {
      if (!route || route.steps.length === 0) return;

      const currentStep = route.steps[currentStepIndex];
      if (!currentStep) return;

      // Distance to current step's end point
      const distToEnd = haversineDistance(currentPos, currentStep.endCoord);
      setDistanceToNextStep(distToEnd);

      // Advance to next step if close enough
      if (distToEnd < 30 && currentStepIndex < route.steps.length - 1) {
        setCurrentStepIndex((prev) => prev + 1);
      }

      // Check if rider is off route (distance to polyline)
      const distToRoute = distanceToPolyline(currentPos, route.polyline);
      if (distToRoute > REROUTE_THRESHOLD && !isRerouting) {
        setIsRerouting(true);
        fetchRoute(currentPos).finally(() => setIsRerouting(false));
      }
    },
    [route, currentStepIndex, isRerouting, fetchRoute],
  );

  // ----------------------------------------------------------
  // Cleanup on unmount
  // ----------------------------------------------------------

  useEffect(() => {
    return () => {
      stopNavigation();
    };
  }, [stopNavigation]);

  // ----------------------------------------------------------
  // Re-fetch route when destination changes (phase switch)
  // ----------------------------------------------------------

  useEffect(() => {
    if (riderLocation && isNavigatingRef.current) {
      fetchRoute(riderLocation);
    }
  }, [destination, destinationType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----------------------------------------------------------
  // Return
  // ----------------------------------------------------------

  const currentStep = route?.steps[currentStepIndex] ?? null;
  const nextStep = route?.steps[currentStepIndex + 1] ?? null;
  const etaMinutes = route
    ? Math.max(0, Math.ceil(route.totalDuration / 60))
    : 0;

  return {
    riderLocation,
    riderHeading,
    gpsAccuracy,
    gpsPermissionGranted,
    route,
    currentStep,
    nextStep,
    distanceToNextStep,
    etaMinutes,
    isRerouting,
    isLoadingRoute,
    startNavigation,
    stopNavigation,
    reroute,
  };
}

// ============================================================
// Utility functions
// ============================================================

/**
 * Haversine distance between two GeoPoints in meters.
 */
function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return R * c;
}

/**
 * Distance from a point to the nearest segment of a polyline (meters).
 */
function distanceToPolyline(point: GeoPoint, polyline: GeoPoint[]): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return haversineDistance(point, polyline[0]);

  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = distanceToSegment(point, polyline[i], polyline[i + 1]);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/**
 * Distance from a point to a line segment (meters).
 */
function distanceToSegment(
  point: GeoPoint,
  segStart: GeoPoint,
  segEnd: GeoPoint,
): number {
  // Approximate by projecting onto the segment
  const l2 =
    (segStart.latitude - segEnd.latitude) ** 2 +
    (segStart.longitude - segEnd.longitude) ** 2;
  if (l2 === 0) return haversineDistance(point, segStart);

  let t =
    ((point.latitude - segStart.latitude) *
      (segEnd.latitude - segStart.latitude) +
      (point.longitude - segStart.longitude) *
        (segEnd.longitude - segStart.longitude)) /
    l2;
  t = Math.max(0, Math.min(1, t));

  const projection: GeoPoint = {
    latitude: segStart.latitude + t * (segEnd.latitude - segStart.latitude),
    longitude: segStart.longitude + t * (segEnd.longitude - segStart.longitude),
  };

  return haversineDistance(point, projection);
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
