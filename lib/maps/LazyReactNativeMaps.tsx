/**
 * lib/maps/LazyReactNativeMaps.tsx
 *
 * Drop-in lazy replacement for `react-native-maps` in Expo Go.
 *
 * react-native-maps' native TurboModule (RNMapsAirModule) is not bundled
 * in Expo Go, so a top-level `import ... from "react-native-maps"` throws at
 * require time and crashes the app. This module dynamically imports it inside
 * try/catch and, on failure, renders SimpleMapFallback (Esri tiles
 * via expo-image) instead.
 *
 * Consumers import from here exactly as they would from "react-native-maps":
 *
 *   import MapView, { Marker, Circle, Polyline, PROVIDER_DEFAULT }
 *     from "@/lib/maps/LazyReactNativeMaps";
 *
 * No JSX changes. When the native module loads (real dev/EAS build) the real
 * components render; when it does not (Expo Go) the map area shows the tile
 * fallback and markers/polygons simply omit — never a crash.
 *
 * @see components/addresses/MapViewWrapper.tsx (same pattern, narrower API)
 */

import { useEffect, useState } from "react";
import type { ComponentType, ReactElement } from "react";
import SimpleMapFallback from "@/features/riders/presentation/components/SimpleMapFallback";
import type { GeoPoint } from "@/types/maps";

type MapComp = ComponentType<any>;

interface MapsModule {
  default: MapComp;
  Marker: MapComp;
  Circle?: MapComp;
  Polyline?: MapComp;
  PROVIDER_DEFAULT?: string;
}

/** Check if react-native-maps native module is actually available at runtime. */
function isNativeMapsModuleAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NativeModules } = require("react-native");
    return !!NativeModules.RNMapsAirModule;
  } catch {
    return false;
  }
}

/** In Jest, the mock is applied via `require`, not dynamic `import()`. */
const isJestEnvironment = typeof globalThis !== "undefined" && "jest" in globalThis;

async function loadMapsModule(): Promise<MapsModule | null> {
  // In Jest, use require to get the mocked module
  if (isJestEnvironment) {
    try {
      return require("react-native-maps") as MapsModule;
    } catch {
      return null;
    }
  }

  // Fast-path: if native module isn't registered, don't even try to import
  if (!isNativeMapsModuleAvailable()) {
    return null;
  }

  try {
    return (await import("react-native-maps")) as MapsModule;
  } catch {
    // Native map module unavailable (Expo Go) — fallback renders below.
    return null;
  }
}

/**
 * Shared loader hook. Each component instance calls it; the module
 * system caches the dynamic import, so only the first call pays.
 */
function useMaps(): MapsModule | null {
  const [module, setModule] = useState<MapsModule | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadMapsModule().then((m) => {
      if (!cancelled) setModule(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return module;
}

function destinationFromProps(props: any): GeoPoint | null {
  const region = props.initialRegion ?? props.region;
  if (region && typeof region.latitude === "number") {
    return { latitude: region.latitude, longitude: region.longitude };
  }
  if (props.destination && typeof props.destination.latitude === "number") {
    return props.destination;
  }
  return null;
}

function FallbackMapView(props: any) {
  const destination = destinationFromProps(props);
  const onMapReady = props.onMapReady;
  const onError = props.onError;

  if (!destination) return null;

  // The tile grid loads asynchronously via expo-image.
  // Forward onLoadEnd/onError so the fallback signals readiness only
  // after tiles are actually visible, and propagates errors.
  return (
    <SimpleMapFallback
      destination={destination}
      isDarkMode={props.isDarkMode}
      onLoadEnd={onMapReady}
      onError={onError}
    />
  );
}

// Marker/Circle/Polyline are looked up off the loaded module at render
// time, so they stay null until the native module is actually present.
function LazyNamedComp(
  key: keyof Pick<MapsModule, "Marker" | "Circle" | "Polyline">,
): MapComp {
  return (props) => {
    const m = useMaps();
    const Actual = m?.[key] as MapComp | undefined;
    if (!Actual) return null;
    return <Actual {...props} />;
  };
}

function SafeMapComponent(props: any): ReactElement | null {
  const m = useMaps();
  if (!m) return <FallbackMapView {...props} />;
  const MapComponent = m.default;
  if (!MapComponent) {
    console.warn("[LazyReactNativeMaps] MapView component not found in module, using fallback");
    return <FallbackMapView {...props} />;
  }
  return <MapComponent {...props} />;
}

export const MapView: MapComp = (props) => {
  // Wrap in try-catch to handle any runtime TurboModule errors
  try {
    return SafeMapComponent(props);
  } catch (e) {
    console.warn("[LazyReactNativeMaps] MapView threw, falling back to tiles:", e);
    return <FallbackMapView {...props} />;
  }
};

export default MapView;

export const Marker = LazyNamedComp("Marker");
export const Circle = LazyNamedComp("Circle");
export const Polyline = LazyNamedComp("Polyline");

// `undefined` is the safe value: FarmersMapView already conditionally spreads
// it (`...(PROVIDER_DEFAULT ? { provider } : {})`), and NativeMapView passes
// it straight to MapView, which ignores an undefined provider.
export const PROVIDER_DEFAULT: string | undefined = undefined;