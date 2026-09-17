# Rider App Map — Current State & Production Plan

## Last updated: 2026-09-15

## Problem

`react-native-maps` (v1.27.2) does not render map tiles in **Expo Go SDK 57**.
The `MapView` native component initializes (Google logo appears) but tiles
never load. This affects **both** the rider app and the main Sagana frontend
app — it is not rider-specific.

### Root cause

Expo Go bundles its own version of the `react-native-maps` native binary.
The JS package version (1.27.2) has a native module version mismatch with
Expo Go SDK 57's bundled binary. The bridge between JS and native silently
fails — no `onMapReady`, no `onError`, no tiles.

### What was tried and ruled out

| Hypothesis                              | Result                                         |
| --------------------------------------- | ---------------------------------------------- |
| Missing Google Maps API key             | ❌ Expo Go provides its own key; not the issue |
| `absoluteFillObject` removed in RN 0.86 | ❌ TypeScript-only error; works at runtime     |
| `userInterfaceStyle` blanking tiles     | ❌ Removing it made no difference              |
| Google Play Services outdated           | ❌ Google Maps app works fine on the phone     |
| Expo Go version mismatch                | ❌ Phone has Expo Go 57.0.9 supporting SDK 57  |
| Network blocking tile servers           | ❌ Google Maps app loads tiles normally        |
| `expo-maps` missing from rider          | ❌ Frontend has `expo-maps`, still blank       |

## Current workaround (Expo Go testing only)

The rider app's `NativeMapView.native.tsx` now uses `SimpleMapFallback`
(Esri World Street Map raster tiles via `expo-image`) instead of
`react-native-maps` `MapView`.

**What works:**

- Static map tiles render (streets, labels, areas)
- Destination marker (warehouse/home icon) overlaid at center
- Rider marker (motorcycle icon) overlaid if GPS available
- No API key required
- No native module dependency

**What doesn't work:**

- No pinch-to-zoom
- No panning
- No route polylines (line from rider to destination)
- No live rider position tracking on the map
- Tile grid is a 3×3 static snapshot, not interactive

**Tile provider:** Esri World Street Map

- URL: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}`
- Free, no API key, no User-Agent requirement
- Previously tried: CARTO (now requires API key), OSM (blocks non-browser requests)

## Production plan

| Phase                           | Map approach                        | How                               | Interactive? |
| ------------------------------- | ----------------------------------- | --------------------------------- | ------------ |
| **Now** (Expo Go testing)       | Esri tile grid (SimpleMapFallback)  | Current code                      | No (static)  |
| **Pilot** (development APK)     | Google Maps via `react-native-maps` | `eas build --profile development` | Yes (full)   |
| **Play Store** (production APK) | Google Maps via `react-native-maps` | `eas build --profile production`  | Yes (full)   |

### Why the development APK will work

Building with `eas build --profile development` compiles
`react-native-maps` into the native APK binary. The JS-to-native
bridge is built at compile time, so there's no version mismatch
with Expo Go's bundled binary. Google Maps tiles render correctly
via Google Play Services on the device.

### What needs to happen for pilot

1. Build development APK: `eas build --profile development --platform android`
2. Install on pilot rider phones
3. Google Maps will render natively (no code change needed — just
   revert `NativeMapView.native.tsx` to use `react-native-maps` `MapView`
   instead of `SimpleMapFallback`, or use a build-time flag)
4. For production: add Google Maps Android API key to `app.json`
   under `android.config.googleMaps.apiKey`

### Build-time switch (recommended)

When ready for the APK build, add a simple flag to switch between
the tile fallback and native MapView:

```typescript
// In NativeMapView.native.tsx
import { Platform } from "react-native";
const USE_NATIVE_MAP = Platform.OS === "ios" || !__DEV__;
// Or use an env var: process.env.EXPO_PUBLIC_USE_NATIVE_MAP
```

This lets Expo Go keep using the tile fallback while APK builds
use the full native Google Maps experience.

## Files involved

| File                         | Role                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `NativeMapView.native.tsx`   | Android/iOS — currently uses SimpleMapFallback (tile grid)     |
| `NativeMapView.tsx`          | Non-platform fallback — still uses react-native-maps (web/dev) |
| `NativeMapView.web.tsx`      | Web — uses SimpleMapFallback                                   |
| `SimpleMapFallback.tsx`      | Esri tile grid renderer (expo-image, no native module)         |
| `RiderNavigationWebView.tsx` | Leaflet WebView map (alternative, not currently used)          |
| `lib/mapTiles.ts`            | Tile provider config + Sagana map colors                       |

## Decision

- Use tile grid for Expo Go testing now ✅
- Switch to native Google Maps for development APK (pilot) ✅
- No Google Maps API key needed for development builds
- Add API key only for production Play Store builds
