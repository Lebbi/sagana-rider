/**
 * src/features/riders/presentation/components/NativeMapView.native.tsx
 *
 * Map view for Android/iOS. Three modes, auto-selected at runtime:
 *
 *   - No Google Play services (Huawei): the Google map is blank there, so a
 *     destination map uses RiderNavigationWebView (bundled Leaflet) and the
 *     orders map with area pins uses the tile grid below.
 *
 *   - No API key (Expo Go OR keyless standalone build):
 *     SimpleMapFallback (CARTO raster tiles via expo-image). The native
 *     react-native-maps MapView requires a Google Maps Android API key
 *     in AndroidManifest.xml — without it, MapView.onCreate throws
 *     "API key not found" and crashes the app. The tile grid always
 *     renders, no key needed.
 *
 *   - With Google Maps API key (standalone builds with key injected via
 *     config plugin): native react-native-maps MapView with Google Maps.
 *     The key is read from Constants.extra.googleMapsApiKey, which is
 *     injected by plugins/withGoogleMapsKey.js at build time.
 */

import { MaterialIcons } from "@/constants/IconTheme";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import RiderNavigationWebView from "@/features/riders/presentation/components/RiderNavigationWebView";
import SimpleMapFallback from "@/features/riders/presentation/components/SimpleMapFallback";
import { hasGoogleServices } from "@/lib/googleServices";
import { DEFAULT_MAP_CENTER } from "@/lib/mapTiles";
import type { GeoPoint, RouteResponse } from "@/types/maps";
import Constants from "expo-constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, type Region } from "react-native-maps";

// Read the Google Maps API key from the config plugin's output.
// The key is injected at build time into Constants.extra.googleMapsApiKey
// by plugins/withGoogleMapsKey.js (which reads the EAS secret).
// This avoids relying on process.env, which EAS Secrets does not populate
// for the JS bundle.
const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.extra?.googleMapsApiKey ?? "";
const USE_NATIVE_MAP = !!GOOGLE_MAPS_API_KEY && hasGoogleServices;

interface NativeMapViewProps {
  route: RouteResponse | null;
  riderLocation: GeoPoint | null;
  riderHeading: number | null;
  destination: GeoPoint | null;
  destinationType: "pickup" | "delivery";
  center?: GeoPoint;
  isDarkMode: boolean;
  onMapReady?: () => void;
  /** Pins besides the destination, such as the farmer while heading to the buyer. */
  extraStops?: MapStop[];
  /** Pins drawn only while inside the visible map area; they never move the camera. */
  areaPins?: GeoPoint[];
  /** Keep the camera on the rider instead of fitting the whole route. */
  followRider?: boolean;
  /** With followRider, turn the map to this heading and tilt it, like turn-by-turn navigation. */
  heading?: number | null;
  /** Called when the rider drags the map, so the screen can stop following. */
  onUserPan?: () => void;
}

type MapStop = { point: GeoPoint; type: "pickup" | "delivery" };

function isInRegion(region: Region, point: GeoPoint): boolean {
  return (
    Math.abs(point.latitude - region.latitude) <= region.latitudeDelta / 2 &&
    Math.abs(point.longitude - region.longitude) <= region.longitudeDelta / 2
  );
}

function StopPin({ type }: { type: MapStop["type"] }) {
  return (
    <View style={styles.markerContainer}>
      <View
        style={[
          styles.marker,
          type === "pickup" ? styles.pickupMarker : styles.deliveryMarker,
        ]}
      >
        <MaterialIcons
          name={type === "pickup" ? "warehouse" : "home"}
          size={22}
          color="#FFFFFF"
        />
      </View>
    </View>
  );
}

export default function NativeMapView({
  route,
  riderLocation,
  riderHeading,
  destination,
  destinationType,
  center,
  isDarkMode,
  onMapReady,
  extraStops,
  areaPins,
  followRider,
  heading,
  onUserPan,
}: NativeMapViewProps) {
  const mapCenter =
    (followRider ? riderLocation : null) ?? center ?? destination ?? DEFAULT_MAP_CENTER;

  if (!hasGoogleServices && destination && !areaPins) {
    return (
      <RiderNavigationWebView
        route={route}
        riderLocation={riderLocation}
        riderHeading={riderHeading}
        destination={destination}
        destinationType={destinationType}
        isDarkMode={isDarkMode}
        onMapReady={onMapReady}
        extraStops={extraStops}
      />
    );
  }

  // ── No Google Maps API key or no Google services: tile grid fallback ──
  if (!USE_NATIVE_MAP) {
    return (
      <ExpoGoMap
        destination={destination}
        destinationType={destinationType}
        isDarkMode={isDarkMode}
        center={mapCenter}
        riderLocation={riderLocation}
        riderHeading={riderHeading}
        onMapReady={onMapReady}
        extraStops={extraStops}
        areaPins={areaPins}
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
      center={mapCenter}
      isDarkMode={isDarkMode}
      onMapReady={onMapReady}
      extraStops={extraStops}
      areaPins={areaPins}
      followRider={followRider}
      heading={heading}
      onUserPan={onUserPan}
    />
  );
}

// Project a geo point to a percentage position within the 3x3 tile grid
// centered on `center` at zoom 13, clamped to the grid edge so a far-away
// point still renders inside the fallback instead of off-screen.
function geoToOverlayPercent(
  center: GeoPoint,
  point: GeoPoint,
): { leftPct: number; topPct: number; inside: boolean } {
  const z = 13;
  const n = Math.pow(2, z);
  const fx = (lng: number) => ((lng + 180) / 360) * n;
  const fy = (lat: number) => {
    const latRad = (lat * Math.PI) / 180;
    return (
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    );
  };
  const cx = Math.floor(fx(center.longitude));
  const cy = Math.floor(fy(center.latitude));
  const leftPct = 50 + (fx(point.longitude) - cx - 0.5) * (100 / 3);
  const topPct = 50 + (fy(point.latitude) - cy - 0.5) * (100 / 3);
  return {
    leftPct: Math.max(2, Math.min(98, leftPct)),
    topPct: Math.max(2, Math.min(98, topPct)),
    inside: leftPct >= 0 && leftPct <= 100 && topPct >= 0 && topPct <= 100,
  };
}

// ═══════════════════════════════════════════════════════════════
// Tile grid fallback — CARTO tiles with overlaid markers
// ═══════════════════════════════════════════════════════════════

function ExpoGoMap({
  destination,
  destinationType,
  isDarkMode,
  center,
  riderLocation,
  riderHeading,
  onMapReady,
  extraStops,
  areaPins,
}: {
  destination: GeoPoint | null;
  destinationType: "pickup" | "delivery";
  isDarkMode: boolean;
  center: GeoPoint;
  riderLocation: GeoPoint | null;
  riderHeading: number | null;
  onMapReady?: () => void;
  extraStops?: MapStop[];
  areaPins?: GeoPoint[];
}) {
  const colors = useColors();
  const t = useT();
  const [isLoading, setIsLoading] = useState(true);

  // Signal ready on mount — tiles load asynchronously via expo-image
  // but the container is interactive right away.
  useEffect(() => {
    setIsLoading(false);
    onMapReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const riderPos = riderLocation
    ? geoToOverlayPercent(center, riderLocation)
    : null;

  return (
    <View style={styles.container}>
      {/* Tile grid — centered on `center` (rider when idle, destination on a delivery) */}
      <SimpleMapFallback destination={center} isDarkMode={isDarkMode} />

      {/* Destination marker — only when a destination is provided (active order) */}
      {destination && (
        <View style={styles.markerOverlay} pointerEvents="none">
          <StopPin type={destinationType} />
        </View>
      )}

      {extraStops?.map((stop, index) => {
        const pos = geoToOverlayPercent(center, stop.point);
        return (
          <View
            key={`stop-${index}`}
            style={[
              styles.riderMarkerOverlay,
              { left: `${pos.leftPct}%`, top: `${pos.topPct}%` },
            ]}
            pointerEvents="none"
          >
            <StopPin type={stop.type} />
          </View>
        );
      })}

      {areaPins?.map((point, index) => {
        const pos = geoToOverlayPercent(center, point);
        if (!pos.inside) return null;
        return (
          <View
            key={`pin-${index}`}
            style={[
              styles.riderMarkerOverlay,
              { left: `${pos.leftPct}%`, top: `${pos.topPct}%` },
            ]}
            pointerEvents="none"
          >
            <StopPin type="pickup" />
          </View>
        );
      })}

      {/* Rider marker — geo-anchored to the rider's GPS within the tile grid */}
      {riderPos && (
        <View
          style={[
            styles.riderMarkerOverlay,
            { left: `${riderPos.leftPct}%`, top: `${riderPos.topPct}%` },
          ]}
          pointerEvents="none"
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
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.primary }]}>
            {t("map.loading")}
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
  center,
  isDarkMode,
  onMapReady,
  extraStops,
  areaPins,
  followRider,
  heading,
  onUserPan,
}: NativeMapViewProps) {
  const mapRef = useRef<MapView>(null);
  const colors = useColors();
  const t = useT();
  const [isLoading, setIsLoading] = useState(true);
  const mapCenter = center ?? destination ?? DEFAULT_MAP_CENTER;
  const headingUp = !!followRider && heading != null;
  const turnedRef = useRef(false);

  const region = {
    latitude: mapCenter.latitude,
    longitude: mapCenter.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);
  const shownPins = areaPins?.filter((p) => isInRegion(visibleRegion ?? region, p));

  // Fit map to show route + rider + destination
  useEffect(() => {
    if (!mapRef.current) return;

    if (followRider && riderLocation) {
      turnedRef.current = headingUp;
      mapRef.current.animateCamera(
        headingUp
          ? { center: riderLocation, zoom: 18, heading: heading ?? 0, pitch: 50 }
          : { center: riderLocation, zoom: 17, heading: 0, pitch: 0 },
        { duration: 500 },
      );
      return;
    }

    if (turnedRef.current) {
      turnedRef.current = false;
      mapRef.current.setCamera({ heading: 0, pitch: 0 });
    }

    const points: GeoPoint[] = [];
    if (destination) points.push(destination);
    extraStops?.forEach((s) => points.push(s.point));
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

    // Single point (or none): center on the resolved map center
    mapRef.current.animateToRegion(
      {
        latitude: mapCenter.latitude,
        longitude: mapCenter.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      500,
    );
  }, [route, riderLocation, destination, extraStops, mapCenter, followRider, heading, headingUp]);

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
        onRegionChangeComplete={setVisibleRegion}
        onPanDrag={onUserPan}
        rotateEnabled={true}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={headingUp}
      >
        {/* Destination marker */}
        {destination && (
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            tracksViewChanges={false}
          >
            <StopPin type={destinationType} />
          </Marker>
        )}

        {extraStops?.map((stop, index) => (
          <Marker
            key={`stop-${index}`}
            coordinate={{
              latitude: stop.point.latitude,
              longitude: stop.point.longitude,
            }}
            tracksViewChanges={false}
          >
            <StopPin type={stop.type} />
          </Marker>
        ))}

        {shownPins?.map((point, index) => (
          <Marker
            key={`pin-${index}`}
            coordinate={{ latitude: point.latitude, longitude: point.longitude }}
            tracksViewChanges={false}
          >
            <StopPin type="pickup" />
          </Marker>
        ))}

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
            {t("map.loading")}
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
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
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
