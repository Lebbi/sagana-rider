import * as Location from "expo-location";
import { useEffect, useState } from "react";

// About 5 km/h. Below it the GPS course is noise, so the compass decides.
const MOVING_SPEED = 1.5;
// Compass readings jitter by a few degrees; turning the camera for each one makes the map swim.
const COMPASS_STEP = 10;

export function pickCameraHeading(
  course: number | null,
  speed: number | null,
  compass: number | null,
): number {
  if (course != null && course >= 0 && (speed ?? 0) >= MOVING_SPEED) return course;
  return compass ?? 0;
}

function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Map heading for heading-up navigation, or null when it is off. */
export function useCameraHeading(
  enabled: boolean,
  course: number | null,
  speed: number | null,
): number | null {
  const [compass, setCompass] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    Location.watchHeadingAsync(({ trueHeading, magHeading }) => {
      const next = trueHeading >= 0 ? trueHeading : magHeading;
      setCompass((prev) => (prev == null || angleGap(prev, next) >= COMPASS_STEP ? next : prev));
    })
      .then((s) => {
        if (cancelled) s.remove();
        else sub = s;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled]);

  return enabled ? pickCameraHeading(course, speed, compass) : null;
}
