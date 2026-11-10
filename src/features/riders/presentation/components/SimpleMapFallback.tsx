/**
 * src/features/riders/presentation/components/SimpleMapFallback.tsx
 *
 * A fallback map that doesn't use WebView. It renders CARTO tiles
 * directly as images using expo-image. This works in Expo Go where WebView
 * with external scripts is blocked.
 *
 * Used by RiderNavigationWebView when the WebView fails to render.
 */

import { getTileStyle, tileUrl } from "@/lib/mapTiles";
import type { GeoPoint } from "@/types/maps";
import { Image } from "expo-image";
import { useMemo, useState, useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";

interface SimpleMapFallbackProps {
  destination: GeoPoint;
  isDarkMode?: boolean;
  onLoadEnd?: () => void;
  onError?: () => void;
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
  onLoadEnd,
  onError,
}: SimpleMapFallbackProps) {
  const zoom = 13;
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
        const url = tileUrl(getTileStyle(isDarkMode), zoom, x, y);
        list.push({ x, y, url });
      }
    }
    return list;
  }, [centerTile, zoom, isDarkMode]);

  const [loadedCount, setLoadedCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const totalTiles = tiles.length; // 9

  const handleTileLoad = useCallback(() => {
    if (hasError) return;
    setLoadedCount((prev) => {
      const next = prev + 1;
      if (next === totalTiles) {
        setTilesLoaded(true);
      }
      return next;
    });
  }, [hasError, totalTiles]);

  // Defer onLoadEnd to avoid "Cannot update during render" error
  useEffect(() => {
    if (tilesLoaded && onLoadEnd) {
      onLoadEnd();
    }
  }, [tilesLoaded, onLoadEnd]);

  const handleTileError = useCallback(() => {
    if (!hasError) {
      setHasError(true);
      // Defer onError to avoid "Cannot update during render" error
      queueMicrotask(() => onError?.());
    }
  }, [hasError, onError]);

  return (
    <View style={styles.container}>
      {/* 3x3 tile grid laid out as 3 rows × 3 columns */}
      {[0, 1, 2].map((row) => (
        <View key={`row-${row}`} style={styles.tileRow}>
          {tiles.slice(row * 3, row * 3 + 3).map((tile) => (
            <Image
              key={`${tile.x}-${tile.y}`}
              source={{ uri: tile.url }}
              style={styles.tile}
              contentFit="cover"
              transition={0}
              onLoadEnd={handleTileLoad}
              onError={handleTileError}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8E8E8",
  },
  tileRow: {
    flex: 1,
    flexDirection: "row",
  },
  tile: {
    flex: 1,
  },
});
