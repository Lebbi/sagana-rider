# Rider Homepage Active Location Pin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the rider homepage mini-map show the rider's live GPS position as the active location pin (continuously updated), centered on the rider when idle, instead of a static "home" icon pinned to a hardcoded default coordinate.

**Architecture:** The screen already fetches live GPS via `useRiderLocation` but discards it at the prop site (`riderLocation={null}`). Three changes: (1) extend the hook to keep watching position after the first fix, (2) add a `center` prop and nullable `destination` to the `NativeMapView` family so the map can center on the rider while the destination marker is independently shown/hidden, and (3) wire the index screen to pass the live coordinate through. The Expo Go tile fallback gets a Mercator projection helper so the rider marker is geo-anchored instead of a fixed screen overlay.

**Tech Stack:** Expo SDK (expo-location ~57.0.22), react-native-maps 1.27.2, React Native, TypeScript (strict), Expo Router.

**Spec:** This plan. The `how` analysis that produced the root cause lives in the session transcript; the key finding is restated in Root Cause below.

## Root Cause (from `/pstack:how` analysis)

There is **no saved-home-address payload** anywhere in the codebase (`RiderSettings` in `types/maps.ts` has only `autoAccept`/`isOnline`/`maxPasabayStops`). The "home address pin" the QA issue describes is actually the delivery-destination marker (a MaterialIcons `home` icon) rendered at `DEFAULT_MAP_CENTER` (San Fernando, Pampanga) when no active order exists. The real bug: `src/features/riders/presentation/screens/index.tsx:472` passes `riderLocation={null}` into `<NativeMapView>` despite holding live GPS in `riderLocation` from `useRiderLocation()` (line 217). Every `NativeMapView` variant gates the rider (two-wheeler) marker on a truthy `riderLocation`, so it never renders.

## Global Constraints

- Repo is `sagana-rider` (not `sagana-frontend`). The task brief's file paths (`apps/rider/app/(tabs)/index.tsx`, `src/components/map/RiderMapView.tsx`) do not exist; the real files are listed per-task below.
- Do NOT modify backend API params or route serialization contracts.
- Do NOT refactor components/styles outside the file list. `ActiveDeliveryPage.tsx` and `RiderNavigationWebView.tsx` must keep working unchanged (they pass a non-null `destination` and omit `center`, so the new interface stays backward-compatible).
- Keep the `useRiderLocation` return shape intact (`location`, `accuracy`, `permissionGranted`, `isLoading`, `error`, `refreshLocation`); only add an internal watch subscription.
- `app.json` already declares `NSLocationWhenInUseUsageDescription` (iOS) and `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` (Android). No permission or dependency additions.
- No test framework exists in `sagana-rider` (no jest config, no `*.test.*` files). Verification is `npx tsc --noEmit` (the `typecheck` script) plus a manual device/Expo Go run. Do NOT introduce jest — out of scope.
- Run lint and typecheck before declaring any task done (per AGENTS.md).

## Review Focus

The five conditions most likely to bite a rider, with the task that pins each:

1. **Permission denied / GPS unavailable on first load.** Map must still render, centered on `DEFAULT_MAP_CENTER`, with no rider marker and no crash. → Task 4 (screen passes `riderLocation ?? null`, `center = riderLocation ?? DEFAULT_MAP_CENTER`); verify via tsc + manual with location permission revoked.
2. **Rider far from destination on an active order (Expo Go tile fallback).** Geo-anchored rider marker must clamp to the 3x3 tile grid edge, not render off-screen or NaN. → Task 2 `geoToOverlayPercent` clamps to `[2, 98]` and handles `point === center`.
3. **Hook unmount mid-watch.** The `watchPositionAsync` subscription must be removed to avoid leaks and state updates after unmount. → Task 1 cleanup effect.
4. **Active order still centers correctly.** With an active order, map centers on the delivery destination and both markers show (destination at center, rider geo-anchored). → Task 4 passes `center = mapDestination` when `activeOrder` exists; Task 2 NativeMap `fitToCoordinates` includes destination + rider.
5. **`ActiveDeliveryPage` regresses.** It still compiles and renders with the new nullable `destination` and optional `center`. → Task 3 interface change keeps `center?` optional and `destination: GeoPoint | null` (non-null assignable); verify via tsc.

---

## Task 1: Continuous GPS watch in `useRiderLocation`

**Files:**
- Modify: `src/features/riders/presentation/hooks/useRiderLocation.ts`

**Interfaces:**
- Consumes: `expo-location` `Location.watchPositionAsync`, `LocationSubscription`.
- Produces: same `UseRiderLocationReturn` shape, unchanged. `location` now updates on every watch tick (not just the first fix). `refreshLocation` stays a one-shot `getCurrentPositionAsync` for pull-to-refresh.

- [ ] **Step 1: Add a `watchRef` and `startWatch` callback**

In `src/features/riders/presentation/hooks/useRiderLocation.ts`, import `useRef` (add to the existing `react` import) and the `LocationSubscription` type from `expo-location`. Inside the hook, add:

```ts
const watchRef = useRef<Location.LocationSubscription | null>(null);

const startWatch = useCallback(async () => {
  const granted = await requestPermission();
  if (!granted) return;
  try {
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setAccuracy(pos.coords.accuracy ?? null);
      },
    );
  } catch (e) {
    if (__DEV__) {
      console.error("[useRiderLocation] Watch error:", e);
    }
    setError("Failed to track location");
  }
}, [requestPermission]);
```

- [ ] **Step 2: Start the watch on mount, unsubscribe on unmount**

Replace the existing initial-fetch effect (lines 84-86) with one that fires the one-shot for a fast first fix AND starts the watch, then tears down the subscription:

```ts
useEffect(() => {
  fetchLocation();
  startWatch();
  return () => {
    watchRef.current?.remove();
    watchRef.current = null;
  };
}, [fetchLocation, startWatch]);
```

`requestForegroundPermissionsAsync` is idempotent, so the second permission call from `startWatch` does not re-prompt the user. Leave `refreshLocation: fetchLocation` as-is.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/riders/presentation/hooks/useRiderLocation.ts
git commit -m "feat(rider): continuous GPS watch in useRiderLocation"
```

---

## Task 2: `center` prop + geo-anchored rider marker in `NativeMapView.native.tsx`

**Files:**
- Modify: `src/features/riders/presentation/components/NativeMapView.native.tsx`

**Interfaces:**
- Consumes: `GeoPoint` from `@/types/maps`; `DEFAULT_MAP_CENTER` from `@/lib/mapTiles` (new import).
- Produces: `NativeMapViewProps` with `destination: GeoPoint | null` (was `GeoPoint`) and a new optional `center?: GeoPoint`. The default export's call signature stays backward-compatible: existing callers passing a non-null `destination` and no `center` still compile and behave as before.

- [ ] **Step 1: Add the `geoToOverlayPercent` helper above `ExpoGoMap`**

Place this module-level pure function before `ExpoGoMap` (around line 89). It projects a geo point to a percentage position within the 3x3 tile grid centered on `center` at zoom 13, clamped to the grid edge:

```ts
function geoToOverlayPercent(
  center: GeoPoint,
  point: GeoPoint,
): { leftPct: number; topPct: number } {
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
  };
}
```

- [ ] **Step 2: Update `NativeMapViewProps` and the default export**

Change the interface (lines 37-45) to:

```ts
interface NativeMapViewProps {
  route: RouteResponse | null;
  riderLocation: GeoPoint | null;
  riderHeading: number | null;
  destination: GeoPoint | null;
  destinationType: "pickup" | "delivery";
  center?: GeoPoint;
  isDarkMode: boolean;
  onMapReady?: () => void;
}
```

Destructure `center` in the default export (line 47) and compute the resolved center once: `const mapCenter = center ?? destination ?? DEFAULT_MAP_CENTER;` Pass `mapCenter` into both `ExpoGoMap` and `NativeMap` as a new `center` prop, alongside the existing props.

- [ ] **Step 3: Update `ExpoGoMap` to center tiles on `center` and geo-anchor the rider marker**

Add `center: GeoPoint` to `ExpoGoMap`'s prop type. Pass `center` to `SimpleMapFallback` as its `destination` prop (SimpleMapFallback's `destination` prop is the tile center). Gate the destination marker overlay on `destination` being non-null (render it only when `destination` is provided). Replace the fixed `riderMarkerOverlay` (lines 142-157) with a geo-anchored overlay whose `left`/`top` come from `geoToOverlayPercent(center, riderLocation)` applied via inline `style` (use `position: "absolute", left: "${leftPct}%", top: "${topPct}%"`), keeping the existing `riderMarker` inner view and `riderHeading` rotation.

- [ ] **Step 4: Update `NativeMap` to center on `center` and handle null `destination`**

Add `center: GeoPoint` to `NativeMap`'s prop type (or reuse `NativeMapViewProps`). Change `region` (lines 188-193) to use `mapCenter` (the resolved `center`) instead of `destination`. In the fit effect (lines 196-225), build `points` conditionally: push `destination` only when non-null, push `riderLocation` when present, push the polyline when present. In the single-point fallback (lines 215-224), `animateToRegion` to `mapCenter`. Gate the destination `<Marker>` (lines 255-278) on `destination` being non-null. The rider `<Marker>` (lines 281-302) is unchanged and now renders because the screen passes a real `riderLocation`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. `index.tsx` still passes `destination={mapDestination}` (a `GeoPoint`) and `riderLocation={null}`, both assignable to the new nullable/`GeoPoint | null` types, so it compiles unchanged here. If any error appears, it is a prop-interface mismatch in this file — fix the interface, not the screen (the screen wiring is Task 4).

- [ ] **Step 6: Commit**

```bash
git add src/features/riders/presentation/components/NativeMapView.native.tsx
git commit -m "feat(map): center prop, geo-anchored rider marker in NativeMapView.native"
```

---

## Task 3: Mirror the interface change in base `NativeMapView.tsx` and `NativeMapView.web.tsx`

`tsc --noEmit` type-checks every `.tsx` file standalone, so all three platform variants must share the same prop interface. The base `.tsx` is the file plain TS module resolution lands on for the `import NativeMapView from ".../NativeMapView"` call; the `.web.tsx` is the web entry.

**Files:**
- Modify: `src/features/riders/presentation/components/NativeMapView.tsx`
- Modify: `src/features/riders/presentation/components/NativeMapView.web.tsx`

**Interfaces:**
- Produces: identical `NativeMapViewProps` to Task 2 (`destination: GeoPoint | null`, `center?: GeoPoint`).

- [ ] **Step 1: Update base `NativeMapView.tsx`**

Apply the same interface change (lines 18-26) and the same `mapCenter = center ?? destination ?? DEFAULT_MAP_CENTER` resolution (import `DEFAULT_MAP_CENTER` from `@/lib/mapTiles`). Change `region` (lines 42-47) to use `mapCenter`. In the fit effect (lines 50-69), push `destination` only when non-null; the existing `if (points.length < 2) return;` guard stays. Gate the destination `<Marker>` (lines 99-122) on `destination` non-null. The rider marker (lines 125-146) is unchanged.

- [ ] **Step 2: Update `NativeMapView.web.tsx`**

Apply the same interface change (lines 15-23). Destructure `center` and compute `mapCenter = center ?? destination ?? DEFAULT_MAP_CENTER` (import `DEFAULT_MAP_CENTER`). Pass `mapCenter` to `SimpleMapFallback` as its `destination` prop. Gate the existing web badge on `destination` being non-null is not required — leave the badge as-is. Optionally add a geo-anchored rider marker overlay reusing `geoToOverlayPercent` (inline the same helper) for parity with the native Expo Go path; if added, gate it on `riderLocation` and clamp via the same helper. If skipped, leave web as a center-only change and note it.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/riders/presentation/components/NativeMapView.tsx src/features/riders/presentation/components/NativeMapView.web.tsx
git commit -m "feat(map): mirror center/nullable-destination interface across NativeMapView variants"
```

---

## Task 4: Wire the index screen to pass live GPS, center, and nullable destination

**Files:**
- Modify: `src/features/riders/presentation/screens/index.tsx`

**Interfaces:**
- Consumes: `NativeMapViewProps` from Task 2/3; `riderLocation` from `useRiderLocation` (Task 1).

- [ ] **Step 1: Compute a nullable destination and a rider-centered center**

Replace the `mapDestination` block (lines 384-390) with:

```ts
const mapDestination: GeoPoint | null = activeOrder
  ? {
      latitude: activeOrder.delivery.address.latitude,
      longitude: activeOrder.delivery.address.longitude,
    }
  : null;
const mapCenter: GeoPoint = activeOrder
  ? mapDestination
  : (riderLocation ?? DEFAULT_MAP_CENTER);
```

`DEFAULT_MAP_CENTER` is already imported (line 21). `GeoPoint` is already imported (line 25).

- [ ] **Step 2: Pass live GPS, center, and destination into `NativeMapView`**

Replace the `<NativeMapView>` call (lines 470-477) with:

```tsx
<NativeMapView
  route={null}
  riderLocation={riderLocation ?? null}
  riderHeading={null}
  destination={mapDestination}
  destinationType="delivery"
  center={mapCenter}
  isDarkMode={false}
/>
```

Leave the `locateButton` View (lines 479-481) and everything else untouched.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Lint**

Run: `npx expo lint`
Expected: 0 errors in the changed files.

- [ ] **Step 5: Commit**

```bash
git add src/features/riders/presentation/screens/index.tsx
git commit -m "fix(rider): show live GPS pin on homepage map, center on rider when idle"
```

---

## Task 5: Manual verification on device / Expo Go

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npx expo start`
Build profile: Expo Go (keyless) exercises the `ExpoGoMap` tile fallback path; a keyed development build exercises the `NativeMap` react-native-maps path. Verify both if possible.

- [ ] **Step 2: Confirm behavior with location granted**

With location permission granted: the homepage mini-map centers on the rider's current GPS, the two-wheeler rider marker renders at the rider's position, and moving physically (or simulating location) moves the marker within the watch cadence (3s / 5m). With an active order, the map centers on the delivery destination and both the destination `home`/`warehouse` marker and the rider marker show.

- [ ] **Step 3: Confirm behavior with location denied**

Revoke location permission. The map renders centered on `DEFAULT_MAP_CENTER` with no rider marker and no crash. No destination marker shows when there is no active order.

- [ ] **Step 4: Confirm `ActiveDeliveryPage` unaffected**

Open an active delivery. The active delivery map still renders with destination + route as before (no `center` passed → defaults to destination; `destination` non-null).