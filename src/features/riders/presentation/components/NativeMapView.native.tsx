/**
 * src/features/riders/presentation/components/NativeMapView.native.tsx
 *
 * Map view for Android/iOS. Two modes, auto-selected at runtime:
 *
 *   - No API key (Expo Go OR keyless standalone build):
 *     SimpleMapFallback (Esri raster tiles via expo-image). The native
 *     react-native-maps MapView requires a Google Maps Android API key
 *     in AndroidManifest.xml — without it, MapView.onCreate throws
 *     "API key not found" and crashes the app. The tile grid always
 *     renders, no key needed.
 *
 *   - With EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (standalone builds with key):
 *     Native react-native-maps MapView with Google Maps. Full pinch-zoom,
 */

import { MaterialIcons } from "@/constants/IconTheme";
import { useColors } from "@/hooks/useColors";
import SimpleMapFallback from "@/features/riders/presentation/components/SimpleMapFallback";
import type { GeoPoint, RouteResponse } from "@/types/maps";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";

// Use native Google Maps MapView only when a Google Maps Android API key
// is available (env var EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, injected at build
// time via eas.json). Without a key, native MapView crashes on onCreate
// with "API key not found" — so we fall back to the Esri tile grid in
// ALL environments that lack one (Expo Go AND keyless standalone builds).
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const USE_NATIVE_MAP = !!GOOGLE_MAPS_API_KEY;

interface NativeMapViewProps {
  route: RouteResponse | null;
  riderLocation: GeoPoint | null;
  riderHeading: number | null;
  destination: GeoPoint;
  destinationType: "pickup" | "delivery";
  isDarkMode: boolean;
  onMapReady?: () => void;
}

export default function NativeMapView({
  route,
  riderLocation,
  riderHeading,
  destination,
  destinationType,
  isDarkMode,
  onMapReady,
}: NativeMapViewProps) {
  const colors = useColors();

  // ── No Google Maps API key: tile grid fallback ────────────────
  if (!USE_NATIVE_MAP) {
    return (
      <ExpoGoMap
        destination={destination}
        destinationType={destinationType}
        isDarkMode={isDarkMode}
        riderLocation={riderLocation}
        riderHeading={riderHeading}
        onMapReady={onMapReady}
      />
    );
  }

  // ── Native builds: full Google Maps MapView ────────────────────
  return (
    <NativeMap
      route={route}
      riderLocation={riderLocation}
      riderHeading={riderHeading}
      destination={destination}
      destinationType={destinationType}
      isDarkMode={isDarkMode}
      onMapReady={onMapReady}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Tile grid fallback — Esri tiles with overlaid markers (no API key)
// ═══════════════════════════════════════════════════════════════

function ExpoGoMap({
  destination,
  destinationType,
  isDarkMode,
  riderLocation,
  riderHeading,
  onMapReady,
}: {
  destination: GeoPoint;
  destinationType: "pickup" | "delivery";
  isDarkMode: boolean;
  riderLocation: GeoPoint | null;
  riderHeading: number | null;
  onMapReady?: () => void;
}) {
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(true);

  // Signal ready on mount — tiles load asynchronously via expo-image
  // but the container is interactive right away.
  useEffect(() => {
    setIsLoading(false);
    onMapReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      {/* Esri tile grid — no native map module needed */}
      <SimpleMapFallback destination={destination} isDarkMode={isDarkMode} />

      {/* Destination marker — centered on the tile grid */}
      <View style={styles.markerOverlay} pointerEvents="none">
        <View style={styles.markerContainer}>
          <View
            style={[
              styles.marker,
              destinationType === "pickup"
                ? styles.pickupMarker
                : styles.deliveryMarker,
            ]}
          >
            <MaterialIcons
              name={destinationType === "pickup" ? "warehouse" : "home"}
              size={22}
              color="#FFFFFF"
            />
          </View>
        </View>
      </View>

      {/* Rider marker — shown if GPS is available, positioned at center-top */}
      {riderLocation && (
        <View style={styles.riderMarkerOverlay} pointerEvents="none">
          <View style={styles.markerContainer}>
            <View
              style={[
                styles.riderMarker,
                {
                  transform: [{ rotate: `${riderHeading ?? 0}deg` }],
                },
              ]}
            >
              <MaterialIcons name="two-wheeler" size={22} color="#FFFFFF" />
            </View>
          </View>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.primary }]}>
            Loading map...
          </Text>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// Native builds — interactive Google Maps (react-native-maps)
// ═══════════════════════════════════════════════════════════════

function NativeMap({
  route,
  riderLocation,
  riderHeading,
  destination,
  destinationType,
  isDarkMode,
  onMapReady,
}: NativeMapViewProps) {
  const mapRef = useRef<MapView>(null);
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(true);

  const region = {
    latitude: destination.latitude,
    longitude: destination.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  // Fit map to show route + rider + destination
  useEffect(() => {
    if (!mapRef.current) return;

    const points: GeoPoint[] = [destination];
    if (riderLocation) points.push(riderLocation);
    if (route?.polyline?.length) points.push(...route.polyline);

    // With 2+ points, fit to show everything
    if (points.length >= 2) {
      mapRef.current.fitToCoordinates(
        points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
        {
          edgePadding: { top: 80, right: 40, bottom: 80, left: 40 },
          animated: true,
        },
      );
      return;
    }

    // With only 1 point (destination, no rider GPS yet), animate to it
    mapRef.current.animateToRegion(
      {
        latitude: destination.latitude,
        longitude: destination.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      500,
    );
  }, [route, riderLocation, destination]);

  const handleMapReady = useCallback(() => {
    setIsLoading(false);
    onMapReady?.();
  }, [onMapReady]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.nativeMap}
        provider={PROVIDER_DEFAULT}
        initialRegion={region}
        showsUserLocation={!!riderLocation}
        followsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsIndoors={false}
        mapType="standard"
        userInterfaceStyle={isDarkMode ? "dark" : "light"}
        onMapReady={handleMapReady}
        rotateEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={false}
      >
        {/* Destination marker */}
        <Marker
          coordinate={{
            latitude: destination.latitude,
            longitude: destination.longitude,
          }}
          tracksViewChanges={false}
        >
          <View style={styles.markerContainer}>
            <View
              style={[
                styles.marker,
                destinationType === "pickup"
                  ? styles.pickupMarker
                  : styles.deliveryMarker,
              ]}
            >
              <MaterialIcons
                name={destinationType === "pickup" ? "warehouse" : "home"}
                size={22}
                color="#FFFFFF"
              />
            </View>
          </View>
        </Marker>

        {/* Rider marker */}
        {riderLocation && (
          <Marker
            coordinate={{
              latitude: riderLocation.latitude,
              longitude: riderLocation.longitude,
            }}
            tracksViewChanges={false}
          >
            <View style={styles.markerContainer}>
              <View
                style={[
                  styles.riderMarker,
                  {
                    transform: [{ rotate: `${riderHeading ?? 0}deg` }],
                  },
                ]}
              >
                <MaterialIcons name="two-wheeler" size={22} color="#FFFFFF" />
              </View>
            </View>
          </Marker>
        )}

        {/* Route polyline (double stroke: dark outline + brand green) */}
        {route?.polyline && route.polyline.length > 0 && (
          <>
            <Polyline
              coordinates={route.polyline.map((p) => ({
                latitude: p.latitude,
                longitude: p.longitude,
              }))}
              strokeColor={isDarkMode ? "#2a4a3a" : "#2c5938"}
              strokeWidth={8}
            />
            <Polyline
              coordinates={route.polyline.map((p) => ({
                latitude: p.latitude,
                longitude: p.longitude,
              }))}
              strokeColor={isDarkMode ? "#8ecb95" : "#396B5C"}
              strokeWidth={5}
            />
          </>
        )}
      </MapView>

      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.primary }]}>
            Loading map...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  nativeMap: {
    flex: 1,
  },
  markerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  riderMarkerOverlay: {
    position: "absolute",
    top: "30%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  marker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  pickupMarker: {
    backgroundColor: "#396B5C",
  },
  deliveryMarker: {
    backgroundColor: "#E53935",
  },
  riderMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#396B5C",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
