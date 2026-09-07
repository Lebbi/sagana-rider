/**
 * src/features/riders/presentation/components/ETABadge.tsx
 *
 * Live ETA countdown badge — shows "12 min • 3.4 km" and counts down.
 * Sagana branded: primaryContainer background, primary text.
 *
 * @see docs/maps-implementation-plan.md
 */

import { scale, verticalScale } from "@/constants/DesignSystem";
import { fontFamily } from "@/constants/FontTheme";
import { useColors } from "@/hooks/useColors";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export interface ETABadgeProps {
  /** Initial ETA in minutes from OSRM. */
  minutes: number;
  /** Total route distance in kilometers. */
  distanceKm: number;
  /** Whether the rider is currently navigating. */
  isNavigating?: boolean;
}

export default function ETABadge({
  minutes,
  distanceKm,
  isNavigating = true,
}: ETABadgeProps) {
  const colors = useColors();
  const [displayMinutes, setDisplayMinutes] = useState(minutes);
  const lastUpdateRef = useRef(Date.now());

  // Count down every second (approximate)
  useEffect(() => {
    setDisplayMinutes(minutes);
    lastUpdateRef.current = Date.now();

    if (!isNavigating || minutes <= 0) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - lastUpdateRef.current) / 1000; // seconds
      const remainingSeconds = Math.max(0, minutes * 60 - elapsed);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      setDisplayMinutes(remainingMinutes);
    }, 1000);

    return () => clearInterval(interval);
  }, [minutes, isNavigating]);

  const etaText = displayMinutes <= 0 ? "Arriving" : `${displayMinutes} min`;
  const distText = distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : "";

  return (
    <View
      style={[styles.container, { backgroundColor: colors.primaryContainer }]}
    >
      <Text
        style={[styles.etaText, { color: colors.primary }]}
        numberOfLines={1}
      >
        {etaText}
      </Text>
      {distText ? (
        <>
          <Text style={[styles.separator, { color: colors.primary }]}>•</Text>
          <Text
            style={[styles.distText, { color: colors.primary }]}
            numberOfLines={1}
          >
            {distText}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(8),
    borderRadius: scale(20),
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  etaText: {
    fontFamily: fontFamily.semiBold,
    fontSize: scale(14),
    fontWeight: "600",
  },
  separator: {
    fontFamily: fontFamily.regular,
    fontSize: scale(14),
  },
  distText: {
    fontFamily: fontFamily.regular,
    fontSize: scale(13),
  },
});
