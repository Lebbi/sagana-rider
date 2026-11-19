# Sagana Rider

The delivery app for **SAGANA**, a farm-to-table marketplace in Pampanga, Philippines. Buyers order produce straight from local farmers, and Sagana riders pick it up at the farm and deliver it.

Sagana Rider is one of three Android apps on the SAGANA platform (buyer, farmer, rider), all served by one Laravel 12 API. This repo is the rider app only. The backend and the buyer/farmer app are private.

## Features

- **Orders:** see available orders, preview the pickup and drop-off before accepting, and optionally auto-accept while on duty
- **Live delivery:** map with the rider's position, route and ETA, plus a timeline from pickup to delivered
- **Turn-by-turn navigation** with voice guidance, including multi-stop ("Pasabay") routes that combine several drops in one trip
- **Offline-safe status updates:** if there is no signal at pickup or drop-off, the update is queued on the phone and sent in order once it reconnects
- **Proof-of-pickup and delivery photos**
- **Chat and in-app voice calls** with buyers and farmers
- **Wallet:** earnings and withdrawal requests
- **Push notifications** for new orders
- **English and Tagalog**
- Account deletion from inside the app (Google Play requirement)

## Tech stack

| Area | Tools |
|---|---|
| App | React Native, Expo (SDK 57, Expo Router), TypeScript |
| Maps & routing | react-native-maps, Leaflet in a WebView with CARTO tiles, OSRM routing, expo-location (background) |
| Real time | Agora voice calls, push notifications via expo-notifications / FCM |
| Storage | expo-secure-store for the auth token, AsyncStorage for the offline queue |
| Quality | Jest (27 test files), TypeScript strict checks, ESLint, Sentry |
| Delivery | EAS Build (development, preview and production profiles), EAS Update for over-the-air fixes |

## Project layout

```
app/                          Expo Router screens (login, tabs, order details)
src/features/riders/          Rider feature: screens, map and navigation components, hooks, utils
lib/                          API clients (orders, chat, wallet, routing), offline outbox, i18n, Sentry
context/                      Signed-in user and auto-accept state
components/, constants/       Shared UI and the Sagana design system
modules/, plugins/            Native config (Google services, Maps key) for EAS builds
```

## Running it

```bash
npm install
npx expo start
```

The app needs a SAGANA API to talk to. Set `EXPO_PUBLIC_API_URL` in `.env.local` to your local backend. Voice calls and some native map features need a development build (`eas build --profile development`) and don't run in Expo Go.

```bash
npm test          # Jest
npm run typecheck # TypeScript
npm run lint      # ESLint
```

## Author

Built by [James Caleb Lugtu](https://linkedin.com/in/jamescaleblugtu), lead developer of SAGANA.
