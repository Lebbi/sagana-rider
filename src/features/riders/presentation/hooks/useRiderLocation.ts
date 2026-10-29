/**
 * src/features/riders/presentation/hooks/useRiderLocation.ts
 *
 * Lightweight hook to get rider's current GPS location for order filtering.
 * Does NOT start navigation - just fetches/updates location for distance calculations.
 *
 * @see docs/maps-implementation-plan.md
 */

import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import type { GeoPoint } from "@/types/maps";

export interface UseRiderLocationReturn {
  location: GeoPoint | null;
  accuracy: number | null;
  permissionGranted: boolean;
  isLoading: boolean;
  error: string | null;
  refreshLocation: () => Promise<GeoPoint | null>;
}

/**
 * Hook to get rider's current location for order distance filtering.
 * Returns the last known location or fetches a fresh one.
 */
export function useRiderLocation(): UseRiderLocationReturn {
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === "granted";
      setPermissionGranted(granted);
      if (!granted) {
        setError("Location permission denied");
      }
      return granted;
    } catch (e) {
      if (__DEV__) {
        console.error("[useRiderLocation] Permission error:", e);
      }
      setError("Failed to request location permission");
      return false;
    }
  }, []);

  const fetchLocation = useCallback(async (): Promise<GeoPoint | null> => {
    const granted = await requestPermission();
    if (!granted) return null;

    setIsLoading(true);
    setError(null);

    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newLocation: GeoPoint = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };

      setLocation(newLocation);
      setAccuracy(pos.coords.accuracy ?? null);
      return newLocation;
    } catch (e) {
      if (__DEV__) {
        console.error("[useRiderLocation] Location fetch error:", e);
      }
      setError("Failed to get current location");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [requestPermission]);

  // One-shot fetch for a fast first fix, then a continuous watch that keeps
  // the coordinate current as the rider moves. The watch is started inside
  // the effect with a `cancelled` flag and a closure-local subscription so
  // that an unmount racing the async permission/watch resolves still tears
  // the subscription down and never calls setState after unmount.
  useEffect(() => {
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;

    fetchLocation();

    (async () => {
      const granted = await requestPermission();
      if (cancelled || !granted) return;
      try {
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
          (pos) => {
            if (cancelled) return;
            setLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
            setAccuracy(pos.coords.accuracy ?? null);
          },
        );
        if (cancelled) {
          sub.remove();
        }
      } catch (e) {
        if (__DEV__) {
          console.error("[useRiderLocation] Watch error:", e);
        }
        if (!cancelled) {
          setError("Failed to track location");
        }
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [fetchLocation, requestPermission]);

  return {
    location,
    accuracy,
    permissionGranted,
    isLoading,
    error,
    refreshLocation: fetchLocation,
  };
}

/**
 * Calculate distance between two points in meters (Haversine formula)
 */
export function calculateDistance(from: GeoPoint, to: GeoPoint): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}