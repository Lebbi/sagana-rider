/**
 * lib/mapTiles.ts
 *
 * Map tile configuration for all Leaflet WebViews in the app.
 * Uses free tile providers (CARTO, Esri, OSM) — no API keys needed.
 *
 * Sagana brand colors are pulled from constants/ColorTheme.ts and embedded
 * here for use inside the WebView HTML (which can't import TS constants).
 *
 * @see docs/maps-implementation-plan.md
 */

import type { GeoPoint } from "@/types/maps";

export type TileStyle =
  | "carto-dark"
  | "carto-light"
  | "carto-voyager"
  | "esri-satellite"
  | "osm-standard";

export interface TileLayerConfig {
  url: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
}

export const TILE_LAYERS: Record<TileStyle, TileLayerConfig> = {
  /** Dark muted theme — looks like Grab's dark map. Good for rider navigation. */
  "carto-dark": {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  },
  /** Clean light theme — looks like Apple Maps. Good for address picking. */
  "carto-light": {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  },
  /** Color modern theme — good for general use. */
  "carto-voyager": {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  },
  /** Free satellite imagery — for precise pin placement. */
  "esri-satellite": {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
    maxZoom: 19,
  },
  /** Standard OSM tiles — most up-to-date road data. */
  "osm-standard": {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap",
    subdomains: "abc",
    maxZoom: 19,
  },
};

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
