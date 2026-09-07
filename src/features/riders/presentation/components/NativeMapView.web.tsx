/**
 * src/features/riders/presentation/components/NativeMapView.web.tsx
 *
 * Web fallback for NativeMapView. react-native-maps is native-only
 * (iOS/Android) and cannot be bundled on web. On web we render the
 * SimpleMapFallback (OpenStreetMap tiles via expo-image) with the same
 * prop interface so consumers don't need to change.
 */

import SimpleMapFallback from "@/features/riders/presentation/components/SimpleMapFallback";
import type { GeoPoint, RouteResponse } from "@/types/maps";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface NativeMapViewProps {
  route: RouteResponse | null;
  riderLocation: GeoPoint | null;
  riderHeading: number | null;
  destination: GeoPoint;
  destinationType: "pickup" | "delivery";
  isDarkMode: boolean;
  onMapReady?: () => void;
}

export default function NativeMapViewWeb({
  destination,
  isDarkMode,
  onMapReady,
}: NativeMapViewProps) {
  const colors = useColors();

  // Signal "ready" immediately on web — tiles load asynchronously
  // but the container is interactive right away.
  if (onMapReady) onMapReady();

  return (
    <View style={styles.container}>
      <SimpleMapFallback destination={destination} isDarkMode={isDarkMode} />
      <View style={styles.webBadge} pointerEvents="none">
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.webBadgeText, { color: colors.textSecondary }]}>
          Map preview (web)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  webBadgeText: {
    fontSize: 11,
  },
});