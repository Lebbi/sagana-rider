/**
 * lib/mapTiles.ts
 *
 * Map tile configuration for all Leaflet WebViews in the app.
 * CARTO raster tiles, keyed by EXPO_PUBLIC_CARTO_BASEMAPS_KEY (EAS env var, read at build time).
 *
 * Sagana brand colors are pulled from constants/ColorTheme.ts and embedded
 * here for use inside the WebView HTML (which can't import TS constants).
 *
 * @see docs/maps-implementation-plan.md
 */

import type { GeoPoint } from "@/types/maps";

export type TileStyle = "carto-dark" | "carto-light";

export interface TileLayerConfig {
  url: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
}

// CARTO serves raster tiles only with a key since 25 Sep 2026; free for commercial use up to 1M tiles a month.
const CARTO_KEY = process.env.EXPO_PUBLIC_CARTO_BASEMAPS_KEY ?? "";
const cartoKeyParam = CARTO_KEY ? `?key=${encodeURIComponent(CARTO_KEY)}` : "";

export const TILE_LAYERS: Record<TileStyle, TileLayerConfig> = {
  "carto-dark": {
    url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${cartoKeyParam}`,
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  },
  "carto-light": {
    url: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${cartoKeyParam}`,
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  },
};

/** One tile's URL, for code that draws tiles without Leaflet. */
export function tileUrl(style: TileStyle, z: number, x: number, y: number): string {
  return TILE_LAYERS[style].url
    .replace("{s}", "a")
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y))
    .replace("{r}", "");
}

/**
 * Sagana brand colors for map elements.
 * Mirrors constants/ColorTheme.ts — kept here as plain strings
 * for injection into WebView HTML.
 */
export const SAGANA_MAP_COLORS = {
  light: {
    routeLine: "#396B5C",
    routeLineOutline: "#2c5938",
    riderMarker: "#396B5C",
    pickupMarker: "#CEEDB2",
    pickupMarkerBorder: "#396B5C",
    deliveryMarker: "#396B5C",
    etaBadgeBg: "#CEEDB2",
    etaBadgeText: "#396B5C",
    destinationPulse: "#396B5C",
  },
  dark: {
    routeLine: "#8ecb95",
    routeLineOutline: "#2a4a3a",
    riderMarker: "#8ecb95",
    pickupMarker: "#2a4a3a",
    pickupMarkerBorder: "#8ecb95",
    deliveryMarker: "#8ecb95",
    etaBadgeBg: "#2a4a3a",
    etaBadgeText: "#8ecb95",
    destinationPulse: "#8ecb95",
  },
} as const;

/**
 * Get the appropriate tile style based on app theme.
 */
export function getTileStyle(isDarkMode: boolean): TileStyle {
  return isDarkMode ? "carto-dark" : "carto-light";
}

/**
 * Get Sagana map colors based on app theme.
 */
export function getMapColors(isDarkMode: boolean) {
  return isDarkMode ? SAGANA_MAP_COLORS.dark : SAGANA_MAP_COLORS.light;
}

/**
 * Default center for the map — San Fernando City, Pampanga.
 * (Service area: whole Pampanga province)
 */
export const DEFAULT_MAP_CENTER: GeoPoint = {
  latitude: 15.0319,
  longitude: 120.6894,
};

export const DEFAULT_MAP_ZOOM = 14;
