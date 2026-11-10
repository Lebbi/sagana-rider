/**
 * Phones without Google Play services (Huawei since 2019) can't draw the
 * Google map and get no fixes from expo-location, whose Android positions come
 * only from Google's fused provider. The local `google-services` module
 * (modules/google-services) answers whether Google is usable and reads
 * Android's own LocationManager instead.
 *
 * getCurrentPositionAsync and watchPositionAsync take and return what
 * expo-location's do, so call sites only change their import.
 */

import { requireOptionalNativeModule } from "expo";
import * as Location from "expo-location";

interface NativeFix {
  watchId: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

interface GoogleServicesModule {
  isGooglePlayServicesAvailable(): boolean;
  startWatching(watchId: number, minTimeMs: number, minDistanceM: number): void;
  stopWatching(watchId: number): void;
  addListener(event: "onLocation", listener: (fix: NativeFix) => void): { remove(): void };
}

const native = requireOptionalNativeModule<GoogleServicesModule>("GoogleServices");

/** Missing module (iOS, Expo Go, jest) means a normal phone: keep Google. */
function checkGoogleServices(): boolean {
  try {
    return native?.isGooglePlayServicesAvailable() ?? true;
  } catch {
    return true;
  }
}

export const hasGoogleServices = checkGoogleServices();

const CURRENT_POSITION_TIMEOUT_MS = 20_000;
let nextWatchId = 1;

function toLocationObject(fix: NativeFix): Location.LocationObject {
  return {
    coords: {
      latitude: fix.latitude,
      longitude: fix.longitude,
      altitude: fix.altitude,
      accuracy: fix.accuracy,
      altitudeAccuracy: null,
      heading: fix.heading,
      speed: fix.speed,
    },
    timestamp: fix.timestamp,
  };
}

export async function watchPositionAsync(
  options: Location.LocationOptions,
  callback: Location.LocationCallback,
): Promise<Location.LocationSubscription> {
  if (hasGoogleServices || !native) {
    return Location.watchPositionAsync(options, callback);
  }
  const watchId = nextWatchId++;
  const listener = native.addListener("onLocation", (fix) => {
    if (fix.watchId === watchId) callback(toLocationObject(fix));
  });
  try {
    native.startWatching(watchId, options.timeInterval ?? 1000, options.distanceInterval ?? 0);
  } catch (e) {
    listener.remove();
    throw e;
  }
  return {
    remove: () => {
      native.stopWatching(watchId);
      listener.remove();
    },
  };
}

export async function getCurrentPositionAsync(
  options: Location.LocationOptions = {},
): Promise<Location.LocationObject> {
  if (hasGoogleServices || !native) {
    return Location.getCurrentPositionAsync(options);
  }
  return new Promise((resolve, reject) => {
    let subscription: Location.LocationSubscription | null = null;
    let settled = false;
    const finish = (result: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription?.remove();
      result();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error("Location request timed out"))),
      CURRENT_POSITION_TIMEOUT_MS,
    );
    watchPositionAsync({ ...options, timeInterval: 0, distanceInterval: 0 }, (location) =>
      finish(() => resolve(location)),
    ).then(
      (sub) => {
        if (settled) sub.remove();
        else subscription = sub;
      },
      (e) => finish(() => reject(e)),
    );
  });
}
