/**
 * src/features/riders/presentation/hooks/useRiderLocation.ts
 *
 * Lightweight hook to get rider's current GPS location for order filtering.
 * Does NOT start navigation - just fetches/updates location for distance calculations.
 *
 * @see docs/maps-implementation-plan.md
 */

import * as Location from "expo-location";
import { getCurrentPositionAsync, watchPositionAsync } from "@/lib/googleServices";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
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

  // Only reads the permission: the rider is asked when going On Duty or
  // accepting an order (RID-48), never when Home opens.
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
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

  // A continuous watch keeps the coordinate current as the rider moves. It
  // starts on the first fetch with permission, so a refresh after a late
  // grant starts it too. Refs let an unmount racing the async start still
  // tear the subscription down and never set state after unmount.
  const mountedRef = useRef(true);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const watchStartingRef = useRef(false);

  const startWatch = useCallback(async () => {
    if (watchRef.current || watchStartingRef.current) return;
    watchStartingRef.current = true;
    try {
      const sub = await watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (pos) => {
          if (!mountedRef.current) return;
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setAccuracy(pos.coords.accuracy ?? null);
        },
      );
      if (mountedRef.current) watchRef.current = sub;
      else sub.remove();
    } catch (e) {
      if (__DEV__) {
        console.error("[useRiderLocation] Watch error:", e);
      }
      if (mountedRef.current) {
        setError("Failed to track location");
      }
    } finally {
      watchStartingRef.current = false;
    }
  }, []);

  const fetchLocation = useCallback(async (): Promise<GeoPoint | null> => {
    const granted = await requestPermission();
    if (!granted) return null;
    void startWatch();

    setIsLoading(true);
    setError(null);

    try {
      const pos = await getCurrentPositionAsync({
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
  }, [requestPermission, startWatch]);

  // One-shot fetch for a fast first fix; it also starts the watch.
  useEffect(() => {
    mountedRef.current = true;
    fetchLocation();
    return () => {
      mountedRef.current = false;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [fetchLocation]);

  // Back from phone Settings after a late grant: start GPS without a prompt.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && !watchRef.current) void fetchLocation();
    });
    return () => sub.remove();
  }, [fetchLocation]);

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