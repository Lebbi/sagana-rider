# Active Delivery Location Fallbacks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make active delivery surface GPS/location failures to the rider and re-fetch the route when GPS arrives after a phase switch, instead of silently dropping the rider into a destination-only map with no explanation.

**Architecture:** Two fixes inside `useRiderNavigation` and one UI surface in `ActiveDeliveryPage`. First, a `pendingRerouteRef` closes the stale-route window where a phase switch with no GPS fix skipped the route re-fetch and never retried. Second, a `locationStatus` state machine replaces the dead `gpsPermissionGranted` output so the screen can tell "denied", "failed", and "granted" apart. Third, the location-off pop-up follows the sagana-frontend UI rule: a `react-native-toast-message` toast with the rider's ported `saganaToastConfig` (pastel card, MaterialIcons, Stack Sans Headline, SaganaPressable), triggered via a `showSaganaToast` helper, with a tap action that opens system settings. No custom banner View.

**Tech Stack:** expo-location ~57.0.22, expo-linking ~57.0.13, React Native, TypeScript (strict), Expo Router.

**Spec:** This plan. Root-cause findings come from the `/pstack:how` analysis of active-delivery location handling (session transcript). The two real gaps it identified: (1) silent GPS-permission failure with no rider-facing fallback and no distinction between "no GPS yet" and "GPS permanently failed"; (2) stale Phase 1 route on phase switch when `riderLocation` is null, because the re-fetch effect guards on `riderLocation` but does not list it in deps.

## Global Constraints

- Repo is `sagana-rider`. Run lint and typecheck before declaring any task done (per AGENTS.md).
- No test framework exists in `sagana-rider` (no jest config, no `*.test.*` files). Verification is `npx tsc --noEmit` (the `typecheck` script) plus a manual device/Expo Go run. Do NOT introduce jest. TDD RED/GREEN is not applicable; each task's gate is tsc plus reasoning.
- Do NOT refactor unrequested components or styles. `ActiveDeliveryPage.styles.ts` is not modified (Task 3 uses the toast system, not a custom banner). `RiderNavigationWebView`, `ETABadge`, `TurnByTurnCard`, `StopProgressCard` are not modified.
- Pop-ups follow the sagana-frontend UI rule: `react-native-toast-message` with a ported `saganaToastConfig` (pastel card, MaterialIcons, Stack Sans Headline, SaganaPressable), triggered via a `showSaganaToast` helper. The rider already has `react-native-toast-message` installed and a `<Toast />` host in `app/_layout.tsx`; Task 3 adds the config and a typed helper.
- Keep `useRiderNavigation`'s existing return fields backward-compatible. `gpsPermissionGranted` stays (add `locationStatus` alongside it, do not remove). `startNavigation`, `stopNavigation`, `reroute` signatures are unchanged.
- `app.json` already declares foreground location permissions. No permission additions. `expo-linking` is already a dependency (`~57.0.13`). `expo-location` is already a dependency.
- The continuous `watchPositionAsync` subscription stays as-is. This plan does not add background tracking or order-status re-polling, both out of scope.

## File set (revised by the banner-follows-frontend-rule constraint)

- Task 1: `src/features/riders/presentation/hooks/useRiderNavigation.ts` (pendingRerouteRef).
- Task 2: `src/features/riders/presentation/hooks/useRiderNavigation.ts` (locationStatus).
- Task 3: `components/ui/saganaToastConfig.tsx` (new), `app/_layout.tsx` (wire config), `src/features/riders/presentation/screens/ActiveDeliveryPage.tsx` (trigger toast).

Net: four files, two of them new/to-the-toast-system (`saganaToastConfig.tsx` new, `_layout.tsx` one-line edit). `ActiveDeliveryPage.styles.ts` is no longer touched.

## Review Focus

The five conditions most likely to bite a rider, with the task that pins each.

1. **Permission denied on first load.** Rider sees a destination-only map with no marker and no route. A reasonable person expects to be told location is off and how to turn it on, not a silent blank map. → Task 2 + Task 3.
2. **`getCurrentPositionAsync` throws.** Rider sees the same silent blank map but the cause is a fix failure, not permission. A reasonable person expects a different message and a way to retry via settings. → Task 2 + Task 3.
3. **Phase switch while GPS is null.** Route stays pointing at the farmer (Phase 1 polyline) until the rider manually reroutes or drifts off-route. A reasonable person expects the route to the buyer to appear once GPS returns. → Task 1.
4. **Phase switch while GPS is present.** Route to the buyer re-fetches immediately, as today. → Task 1.
5. **Toast tap opens system settings.** The toast's `onPress` should deep-link to the OS settings screen via `Linking.openSettings()`, not a no-op or an in-app dead end. → Task 3.

---

## Task 1: Close the stale-route window on phase switch

**Files:**
- Modify: `src/features/riders/presentation/hooks/useRiderNavigation.ts`

**Interfaces:**
- Consumes: the existing `destination`/`destinationType` props and the continuous watch callback.
- Produces: no new public field. Adds an internal `pendingRerouteRef` that defers the route re-fetch until the next GPS tick when a phase switch happens with `riderLocation` null.

- [ ] **Step 1: Add the `pendingRerouteRef`**

In `src/features/riders/presentation/hooks/useRiderNavigation.ts`, add next to the other refs (after `lastBroadcastRef` at line 82):

```ts
const pendingRerouteRef = useRef(false);
```

- [ ] **Step 2: Set the flag when destination changes and GPS is null**

Replace the destination-change effect (lines 279-283) so that a missing GPS fix defers the re-fetch instead of dropping it:

```ts
useEffect(() => {
  if (!isNavigatingRef.current) return;
  if (riderLocation) {
    fetchRoute(riderLocation);
  } else {
    pendingRerouteRef.current = true;
  }
}, [destination, destinationType]); // eslint-disable-line react-hooks/exhaustive-deps
```

The guard on `isNavigatingRef.current` stays. The `riderLocation` dep stays omitted (eslint-disabled as before) because the flag now carries the deferral.

- [ ] **Step 3: Flush the deferral on the next GPS tick**

In the `watchPositionAsync` callback, after `setGpsAccuracy(...)` (line 182) and before the broadcast block (line 184), add:

```ts
if (pendingRerouteRef.current) {
  pendingRerouteRef.current = false;
  fetchRoute(newLocation);
}
```

This runs once: the first tick after the phase switch clears the flag and fetches the Phase 2 route. Subsequent ticks do nothing because the flag is false. The manual `reroute` (line 228) and the off-route auto-reroute in `updateStepProgress` (line 257) are unchanged and still work.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/riders/presentation/hooks/useRiderNavigation.ts
git commit -m "fix(rider): re-fetch route when GPS returns after phase switch"
```

---

## Task 2: Add a `locationStatus` state machine to the navigation hook

**Files:**
- Modify: `src/features/riders/presentation/hooks/useRiderNavigation.ts`

**Interfaces:**
- Consumes: `requestForegroundPermissionsAsync` and `getCurrentPositionAsync` outcomes.
- Produces: a new `locationStatus: "idle" | "requesting" | "granted" | "denied" | "failed"` field on `UseRiderNavigationReturn`. `gpsPermissionGranted` stays for backward compatibility.

- [ ] **Step 1: Add the state**

In `src/features/riders/presentation/hooks/useRiderNavigation.ts`, add next to `gpsPermissionGranted` (line 70):

```ts
const [locationStatus, setLocationStatus] = useState<
  "idle" | "requesting" | "granted" | "denied" | "failed"
>("idle");
```

- [ ] **Step 2: Drive the state from permission and fix outcomes**

Set the status at each decision point. The transitions are a small state machine, not a free-form flag, so the exact placements are:

- `requestLocationPermission` (lines 88-105): on `granted`, call `setLocationStatus("requesting")` alongside `setGpsPermissionGranted(granted)` (line 92). On `!granted`, call `setLocationStatus("denied")` inside the existing `if (!granted)` block (line 94). On the catch (line 99), call `setLocationStatus("denied")` before `return false`.
- `startNavigation` (lines 141-210): permission denied returns early at line 143, which already leaves `locationStatus` as `"denied"` from step above, so no extra set is needed there. After the initial `getCurrentPositionAsync` succeeds, set `setLocationStatus("granted")` right after `setGpsAccuracy(initialPos.coords.accuracy ?? null)` (line 160). In the catch (line 205), set `setLocationStatus("failed")` before the dev log.
- The watch callback (line 172) does not change `locationStatus` once granted.

- [ ] **Step 3: Expose `locationStatus` in the return**

Add `locationStatus` to the returned object (after `gpsPermissionGranted` at line 299):

```ts
return {
  riderLocation,
  riderHeading,
  gpsAccuracy,
  gpsPermissionGranted,
  locationStatus,
  route,
  ...
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/riders/presentation/hooks/useRiderNavigation.ts
git commit -m "feat(rider): expose locationStatus from useRiderNavigation"
```

---

## Task 3: Surface the location-off pop-up as a sagana toast

This task follows the sagana-frontend UI rule for pop-ups: `react-native-toast-message` with the project's `saganaToastConfig` (pastel card, MaterialIcons, Stack Sans Headline, SaganaPressable), triggered via a `showSaganaToast` helper. No custom banner View, no custom banner styles.

**Files:**
- Create: `components/ui/saganaToastConfig.tsx`
- Modify: `app/_layout.tsx`
- Modify: `src/features/riders/presentation/screens/ActiveDeliveryPage.tsx`

**Interfaces:**
- Consumes: `nav.locationStatus` produced by Task 2. `Linking.openSettings()` from `expo-linking`.
- Produces: `saganaToastConfig` (a `ToastConfig`) and `showSaganaToast(opts)` (a typed trigger helper). Wiring `<Toast config={saganaToastConfig} />` in `_layout.tsx` also restyles the existing `handleApiError`/`handleApiSuccess` toasts to the sagana design, with no change to their call sites.

- [ ] **Step 1: Create `components/ui/saganaToastConfig.tsx`**

Port the frontend `components/ui/saganaToastConfig.tsx` adapted to the rider's tokens. Use `MaterialIcons` from `@expo/vector-icons` (not `MaterialCommunityIcons`), `saganaPalette` from `@/constants/ColorTheme`, `SaganaPressable` from `@/components/ui/SaganaPressable`, and Stack Sans Headline families from `@/constants/FontTheme` (`fontFamily.medium`, `fontFamily.semiBold`). MaterialIcons names: success icon `check`, info icon `info`, error icon `warning`; success watermark `agriculture`, info watermark `leaf`, error watermark `warning`. Export `saganaToastConfig: ToastConfig` and a `showSaganaToast` helper:

```ts
export type SaganaToastVariant = "success" | "error" | "info";

export interface ShowSaganaToastOpts {
  type: SaganaToastVariant;
  text1: string;
  text2?: string;
  actionHint?: string;
  onPress?: () => void;
  visibilityTime?: number;
}

export function showSaganaToast(opts: ShowSaganaToastOpts) {
  Toast.show({
    type: opts.type,
    text1: opts.text1,
    text2: opts.text2,
    visibilityTime: opts.visibilityTime ?? 4000,
    onPress: opts.onPress,
    props: { actionHint: opts.actionHint },
  });
}
```

Keep the pastel card layout, icon circle, and watermark motif from the frontend config. `onPress` is undefined at runtime when no handler is passed; keep the same defensive cast the frontend uses so the pressable is disabled when there is no action.

- [ ] **Step 2: Wire the config in `app/_layout.tsx`**

In `app/_layout.tsx`, import `saganaToastConfig` from `@/components/ui/saganaToastConfig` and pass it to the existing `<Toast />` host:

```tsx
<Toast config={saganaToastConfig} />
```

The host already mounts (the comment at lines 78-80 says it is required for `handleApiSuccess`/`handleApiError`). This restyles those existing toasts to the sagana design with no change to their call sites.

- [ ] **Step 3: Trigger the toast from `ActiveDeliveryPage`**

In `src/features/riders/presentation/screens/ActiveDeliveryPage.tsx`, import `showSaganaToast` from `@/components/ui/saganaToastConfig` and `Linking` from `expo-linking`. Add an effect that fires the toast exactly once when location is denied or failed:

```tsx
useEffect(() => {
  if (nav.locationStatus === "denied" || nav.locationStatus === "failed") {
    showSaganaToast({
      type: "error",
      text1: nav.locationStatus === "denied"
        ? "Location is off"
        : "Couldn’t get your location",
      text2: nav.locationStatus === "denied"
        ? "Turn it on to see your route and ETA."
        : "Tap to check settings.",
      actionHint: "Open settings",
      onPress: () => Linking.openSettings(),
    });
  }
}, [nav.locationStatus]);
```

No banner View and no `locationBanner` styles are added to `ActiveDeliveryPage.styles.ts`. The bottom sheet, ETA badge, and turn-by-turn card are untouched. The toast is non-blocking and auto-dismisses; the rider can still see the destination and proceed with the delivery.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Lint**

Run: `npx expo lint`
Expected: 0 new errors in the changed files. Pre-existing `react-hooks/set-state-in-effect` errors in `useRiderNavigation.ts` are out of scope and not introduced here.

- [ ] **Step 6: Commit**

```bash
git add components/ui/saganaToastConfig.tsx app/_layout.tsx src/features/riders/presentation/screens/ActiveDeliveryPage.tsx
git commit -m "feat(rider): surface location-off toast via sagana toast config"
```

---

## Task 4: Manual verification on device / Expo Go

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npx expo start`

- [ ] **Step 2: Permission denied path**

Revoke location permission. Open an active delivery. The map renders destination-only. The banner shows "Location is off — turn it on to see your route and ETA." with an "Open settings" button. Tapping it opens the device settings screen. The bottom sheet, ETA badge, and turn-by-turn card still render. No crash.

- [ ] **Step 3: Fix failure path**

With permission granted but GPS unavailable (airplane mode or indoor weak fix), open an active delivery. The banner shows "Couldn't get your location — tap to check settings." The map still centers on the destination. No crash.

- [ ] **Step 4: Phase switch with GPS dropout**

Start an active delivery in Phase 1. Simulate a GPS dropout at the moment the pickup checklist completes and the phase flips to Phase 2. When GPS returns, the route to the buyer appears without a manual reroute tap. Confirm the Phase 1 polyline does not linger.

- [ ] **Step 5: Happy path**

Permission granted, GPS fix acquired. Open an active delivery. The rider marker renders, the route line appears, ETA counts down. Complete Phase 1; the route re-fetches to the buyer destination and the rider marker continues tracking with no interruption. No banner appears at any point.