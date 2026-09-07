/**
 * src/features/riders/presentation/components/NativeMapView.tsx
 *
 * Interactive map using react-native-maps.
 * Supports pinch zoom, pan, markers, and polylines.
 * Works in Expo Go without API keys.
 *
 * Replaces the WebView-based map which was blocked in Expo Go.
 */

import { MaterialIcons } from "@/constants/IconTheme";
import { useColors } from "@/hooks/useColors";
import type { GeoPoint, RouteResponse } from "@/types/maps";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";

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
  const mapRef = useRef<MapView>(null);
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

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

    // With only 1 point (destination, no rider GPS yet), animate to it with a visible zoom
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
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={region}
        showsUserLocation={!!riderLocation}
        followsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsIndoors={false}
        mapType={isDarkMode ? "standard" : "standard"}
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

        {/* Route polyline */}
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

      {hasError && (
        <View style={styles.errorOverlay}>
          <MaterialIcons name="cloud-off" size={40} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>
            Map failed to load
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            Check your internet connection
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
  map: {
    ...StyleSheet.absoluteFillObject,
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
  markerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  deliveryMarkerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
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
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
  },
  errorSubtext: {
    fontSize: 12,
  },
});
