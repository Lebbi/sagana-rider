/**
 * src/features/riders/presentation/components/SimpleMapFallback.tsx
 *
 * A fallback map that doesn't use WebView. It renders OpenStreetMap tiles
 * directly as images using expo-image. This works in Expo Go where WebView
 * with external scripts is blocked.
 *
 * Used by RiderNavigationWebView when the WebView fails to render.
 */

import type { GeoPoint } from "@/types/maps";
import { Image } from "expo-image";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

interface SimpleMapFallbackProps {
  destination: GeoPoint;
  isDarkMode?: boolean;
}

// Convert lat/lng to tile numbers at zoom level z
function latLngToTile(lat: number, lng: number, z: number) {
  const n = Math.pow(2, z);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

export default function SimpleMapFallback({
  destination,
  isDarkMode = false,
}: SimpleMapFallbackProps) {
  const zoom = 14;
  const centerTile = useMemo(
    () => latLngToTile(destination.latitude, destination.longitude, zoom),
    [destination.latitude, destination.longitude],
  );

  // Create a 3x3 grid of tiles centered on the destination
  const tiles = useMemo(() => {
    const list: { x: number; y: number; url: string }[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = centerTile.x + dx;
        const y = centerTile.y + dy;
        // Use CARTO light tiles (free, no API key)
        const url = isDarkMode
          ? `https://a.basemaps.cartocdn.com/dark_all/${zoom}/${x}/${y}.png`
          : `https://a.basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}.png`;
        list.push({ x, y, url });
      }
    }
    return list;
  }, [centerTile, zoom, isDarkMode]);

  return (
    <View style={styles.container}>
      <View style={styles.tileGrid}>
        {tiles.map((tile, index) => (
          <Image
            key={`${tile.x}-${tile.y}-${index}`}
            source={{ uri: tile.url }}
            style={styles.tile}
            contentFit="cover"
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  tileGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tile: {
    width: "33.333%",
    height: "33.333%",
  },
});
