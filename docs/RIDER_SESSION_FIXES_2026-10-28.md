# Rider App Session Fixes — 2026-10-28

Three bugs fixed in one session. Each section names the symptom, the root cause, the fix, and the file touched.

## 1. App crashed after login with "API key not found"

**Symptom.** App built with `npx expo run:android --device` logged in fine, then crashed before reaching the Home tab.

```
java.lang.IllegalStateException: API key not found. Check that
<meta-data android:name="com.google.android.geo.API_KEY" android:value="your API key"/>
is in the <application> element of AndroidManifest.xml
```

**Root cause.** The config plugin `plugins/withGoogleMapsKey.js` injects the Google Maps API key into `AndroidManifest.xml` as a `<meta-data>` tag. It resolved the key from two sources.

```js
const apiKey = process.env.GOOGLE_MAPS_API_KEY || config.exp?.extra?.googleMapsApiKey || "";
```

Both sources were empty at plugin run time.

- `config.exp.extra` is empty when Expo evaluates config plugins. The `extra` field from `app.json` is not populated on the config object passed to the plugin function. Confirmed with a debug log that printed `config.exp keys: []`.
- `process.env.GOOGLE_MAPS_API_KEY` was not set. The `.env.local` file (loaded by Expo during prebuild) defines `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, not `GOOGLE_MAPS_API_KEY`. The plugin read the wrong env var name.

So the plugin printed its "not set" warning and injected nothing. The native Google Maps SDK then threw because the `meta-data` tag was missing.

**Fix.** `plugins/withGoogleMapsKey.js` now reads the env var that `.env.local` actually defines.

```js
const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
```

The key is resolved once from the outer config (not inside the `withAndroidManifest` callback, where `config.exp` is also empty) and used for both the manifest injection and the `extra.googleMapsApiKey` runtime field.

**Verify.** After `npx expo prebuild --clean`, the manifest now contains the tag.

```
<meta-data android:name="com.google.android.geo.API_KEY" android:value="AIzaSy..."/>
```

The crash is gone and the Home tab loads.

## 2. Available Orders showed for one second then vanished

**Symptom.** After login, the Home tab showed Available Orders briefly, then the list went empty and never came back.

**Root cause.** The Home screen filtered available orders to a 10 km radius around the rider's GPS.

```js
const availableCards = availableOrders
  .map((o) => toOrderCard(o, false, riderLocation ?? undefined))
  .filter((card) => {
    if (!riderLocation || card.pickupDistance === null) return true;
    return card.pickupDistance <= 10000; // 10km max
  });
```

`useRiderLocation` fetches GPS asynchronously. `location` starts `null`, so the filter passed every order on the first render. About one second later the GPS fix arrived, `riderLocation` populated, and the filter ran. Every test order was more than 10 km from the rider, so all 47 searching orders were dropped. The list went from full to empty the moment location loaded.

Confirmed with a diagnostic log.

```
[RiderHome] Raw API response: 59 orders | statuses: 59:searching,58:searching,...
[RiderHome] Available (searching): 47
[RiderHome] availableOrders: 47 | after filter: 0 | riderLocation: 14.978,120.580
```

47 searching orders came back from the backend. 0 survived the filter.

**Fix.** `src/features/riders/presentation/screens/index.tsx` no longer filters by distance. It sorts by pickup distance, closest first, so the rider sees every searching order with the distance label telling them how far each one is. Unknown distances sink to the end.

```js
const availableCards = availableOrders
  .map((o) => toOrderCard(o, false, riderLocation ?? undefined))
  .sort((a, b) => {
    const aD = a.pickupDistance ?? Infinity;
    const bD = b.pickupDistance ?? Infinity;
    return aD - bD;
  });
```

**Verify.** Typecheck passes. On reload all 47 searching orders stay visible, ordered nearest first.

## 3. API base URL pointed at localhost for device builds

**Symptom.** The rider app on a physical device never reached the backend. Render logs showed no `/api/rider/orders` calls, only `GET /index.php` health checks.

**Root cause (turned out to be a non-issue).** `lib/api.ts` defaults the base URL to `http://localhost:8000/api` when `EXPO_PUBLIC_API_URL` is unset. On a physical device, `localhost` is the device itself, not the laptop.

**Resolution.** The URL was already set correctly in two places.

- `.env.local` defines `EXPO_PUBLIC_API_URL=https://sagana-api.onrender.com/api`.
- `eas.json` defines the same value in the `env` block for the `preview`, `production`, and `google-play` build profiles.

EAS bakes the `eas.json` env var into the APK at build time. The earlier device test that showed no API calls was a stale build. Reinstalling a fresh EAS preview APK (or running `npx expo run:android --device` after `npx expo prebuild --clean`) made the app hit the Render URL. Metro now logs `[API][REQUEST] GET https://sagana-api.onrender.com/api/rider/orders`.

No code changed for this one. The fix was a clean rebuild.

## Files changed

- `plugins/withGoogleMapsKey.js` — read the correct env var, resolve the key once from the outer config.
- `src/features/riders/presentation/screens/index.tsx` — replaced the 10 km distance filter with a nearest-first sort.

## What was not checked

- iOS side of the Google Maps key injection (the device test was Android only).
- Whether the backend should filter searching orders by proximity server-side instead of relying on the client to sort. That is a backend change and out of scope for this session.