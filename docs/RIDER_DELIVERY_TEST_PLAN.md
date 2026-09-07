# Sagana Delivery Flow — Test Plan

> **Region:** Philippines (Pampanga, Central Luzon)
> **Platform:** Expo (React Native) + Laravel 12 API + MySQL
> **Last Updated:** 2026-09-02

---

## Overview

```
Buyer places order → Order assigned to Rider → Rider navigates to Farmer →
Rider picks up product → Rider navigates to Buyer → Rider delivers product →
Order completed & payment settled
```

Sagana is a logistics/on-demand pickup-delivery model:

- **Pickup** from farmer's farm/depot
- **Delivery** to buyer's address
- **Checkbox-based** pickup confirmation (not OTP — OTP is a future feature)
- **Live GPS tracking** via OSRM routing proxy
- **3-way payment split** (farmer + rider + platform) via `order_financials`

### Status Flow

```
searching → accepted → to_pickup → arrived_pickup → picked_up → to_delivery → arrived_delivery → delivered
                                                                                                    ↗
                                                        any status → cancelled
```

---

## Feature Implementation Status

| Feature                                   | Status         | Notes                                                      |
| ----------------------------------------- | -------------- | ---------------------------------------------------------- |
| Order assignment to rider                 | ✅ Implemented | `POST /api/rider/orders/{id}/accept`                       |
| Status transitions                        | ✅ Implemented | `PATCH /api/rider/orders/{id}/status` with flow validation |
| Checkbox pickup confirmation              | ✅ Implemented | ActiveDeliveryPage — check all items → Phase 2             |
| Map + routing                             | ✅ Implemented | `POST /api/routing/directions` proxies OSRM                |
| Back button on ActiveDeliveryPage         | ✅ Implemented | Returns to Home                                            |
| Wallet credit on delivery                 | ✅ Implemented | `RiderOrderService::creditRiderWallet()`                   |
| Settings (on-duty, auto-accept)           | ✅ Implemented | `GET/PATCH /api/rider/settings`                            |
| Payment split (3-way)                     | ✅ Implemented | `OrderPricingService` + `order_financials`                 |
| Delivery fee display                      | ✅ Implemented | Falls back to `order_financials.shipping_fee`              |
| Order cancellation by rider               | ✅ Minimal     | Bare status flip, no reason field                          |
| Photo upload (proof_photo)                | ⚠️ Partial     | Validated in API but never stored — no DB column           |
| Rider declines order                      | ❌ Missing     | No decline endpoint                                        |
| OTP verification (pickup/delivery)        | ❌ Missing     | Future feature                                             |
| Push notifications                        | ❌ Missing     | In-app Notification model exists, no FCM/APNS              |
| Rider rating system                       | ❌ Missing     | Future feature                                             |
| Offline sync/queue                        | ❌ Missing     | Future feature                                             |
| Auto-assignment (rider pool)              | ❌ Missing     | Riders manually accept from pool                           |
| Multi-farmer orders                       | ❌ Blocked     | One-farmer-per-checkout is V1.0 hard rule                  |
| Weight mismatch at pickup (rider-flagged) | ❌ Missing     | Weight reconciliation is seller-triggered only             |

---

## Phase 1: Pre-Testing Setup

### 1.1 Test Environment

| Item          | Status    | Details                                                                                               |
| ------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| Test accounts | ✅ Ready  | Carlos Reyes (`carlos.rider@sagana.local`), Jun Delos Reyes (`jun.rider@sagana.local`)                |
| Test farmers  | ✅ Ready  | Tessa Magbanua (`tessa.farmer@sagana.local`), Maria Santos, others from `RealisticFilipinoDataSeeder` |
| Test buyers   | ✅ Ready  | Multiple buyers from seeder with addresses in Pampanga                                                |
| Test products | ✅ Ready  | Produce catalog seeded (kamatis, talong, ampalaya, etc.)                                              |
| Test orders   | ✅ Ready  | `RiderOrderSeeder` assigns 10 orders to Carlos (6 delivered, 2 searching, 2 processing, 1 cancelled)  |
| Rider wallet  | ✅ Ready  | ₱162 available balance from delivered orders                                                          |
| GPS mocking   | ⚠️ Manual | Use Android "Mock Location" dev setting or GPS simulator app                                          |

### 1.2 Test Data Summary

| Rider           | Email                       | Password       | Vehicle               | Wallet                  |
| --------------- | --------------------------- | -------------- | --------------------- | ----------------------- |
| Carlos Reyes    | `carlos.rider@sagana.local` | `Password123!` | Motorcycle (NDD-1234) | ₱162                    |
| Jun Delos Reyes | `jun.rider@sagana.local`    | `Password123!` | Bicycle               | ₱0 (no orders assigned) |

### 1.3 Test API Endpoint (Recommended Addition)

A test-only endpoint to advance order status without going through the full flow:

```
POST /api/test/order/{id}/advance-status
Body: { "status": "to_pickup" }
```

> **Status:** Not yet implemented — recommend adding to speed up testing.

### 1.4 Devices & Networks

- Test on real Android devices (Samsung A-series, Xiaomi, Tecno — common rider phones)
- Simulate network conditions: 4G, 3G, Wi-Fi, offline (rural Pampanga areas may have poor signal)
- Test with GPS mock locations to simulate rider movement

---

## Phase 2: Functional Test Cases (End-to-End)

### Section A: Buyer Orders Product (Buyer App)

> Already tested in buyer-side QA. Summarized here for completeness.

| #   | Test Case                              | Expected Result                                        | Status    |
| --- | -------------------------------------- | ------------------------------------------------------ | --------- |
| A1  | Buyer logs in                          | Session active, role = "buyer"                         | ✅ Tested |
| A2  | Buyer browses farm products            | Product list loads with images, prices, farmer names   | ✅ Tested |
| A3  | Buyer adds product to cart             | Cart shows item name, quantity, price                  | ✅ Tested |
| A4  | Buyer checks out                       | Order summary shows product, delivery fee (₱60), total | ✅ Tested |
| A5  | Buyer selects payment method           | COD or GCash selectable                                | ✅ Tested |
| A6  | Buyer places order                     | Order confirmation, unique order ID generated          | ✅ Tested |
| A7  | Order appears in buyer's order history | Full details visible                                   | ✅ Tested |

### Section B: Rider Accepts Order (Rider App)

| #   | Test Case                            | Expected Result                                                     | Status                              |
| --- | ------------------------------------ | ------------------------------------------------------------------- | ----------------------------------- |
| B1  | Rider logs in as Carlos              | Lands on rider homepage (not buyer homepage)                        | ✅ Tested                           |
| B2  | Rider sees on-duty toggle            | Toggle is ON by default, persists on restart                        | ✅ Tested                           |
| B3  | Rider sees auto-accept toggle        | Toggle is OFF by default, persists on restart                       | ✅ Tested                           |
| B4  | Rider sees available orders on Home  | "Available Orders" section shows orders with `searching` status     | ✅ Works                            |
| B5  | Rider sees active delivery on Home   | "Active Delivery" section shows orders in processing states         | ✅ Works                            |
| B6  | Rider taps an available order card   | Navigates to ActiveDeliveryPage with correct orderId                | ✅ Works                            |
| B7  | Rider accepts order via API          | `POST /api/rider/orders/{id}/accept` → status changes to `accepted` | ✅ Tested (unit + feature)          |
| B8  | Order price shows ₱60.00 (not ₱0.00) | `shippingFee` displays correctly on order card                      | ✅ Fixed                            |
| B9  | ~~Rider declines order~~             | ~~Order re-assigned~~                                               | ❌ Not implemented — future feature |
| B10 | ~~Auto-assignment to nearest rider~~ | ~~Rider receives push notification~~                                | ❌ Not implemented — future feature |

### Section C: Rider Navigates to Farmer (Pickup Phase)

| #   | Test Case                                    | Expected Result                                                          | Status                                         |
| --- | -------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| C1  | ActiveDeliveryPage loads                     | Map renders, farmer pin visible at pickup coordinates                    | ✅ Fixed (NativeMapView single-point fit)      |
| C2  | Map shows farmer's name and phone in top bar | Header shows `order.pickup.farmerName` and `farmerPhone`                 | ✅ Works                                       |
| C3  | Back button returns to Home                  | Tapping back arrow calls `router.back()`                                 | ✅ Fixed                                       |
| C4  | Route polyline renders on map                | `POST /api/routing/directions` returns polyline from rider GPS to farmer | ✅ Fixed (RoutingController proxy)             |
| C5  | ETA badge shows time + distance              | ETABadge renders `nav.etaMinutes` and `nav.route.totalDistance`          | ✅ Works                                       |
| C6  | Turn-by-turn card shows next instruction     | TurnByTurnCard renders `nav.currentStep`                                 | ✅ Works                                       |
| C7  | Phase 1 pill is active, Phase 2 is inactive  | "Phase 1: Going to Farmer" highlighted                                   | ✅ Works                                       |
| C8  | ~~Rider arrives at farm → geofence trigger~~ | ~~Auto status change to `arrived_pickup`~~                               | ❌ Not implemented — manual status update only |
| C9  | ~~Offline: rider loses network~~             | ~~Actions stored locally, sync on reconnect~~                            | ❌ Not implemented — future feature            |

### Section D: Pickup at Farmer

| #   | Test Case                                   | Expected Result                                                           | Status                                            |
| --- | ------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| D1  | Items to collect list shows all order items | Each item: `productName`, `variationName`, `quantity`, `unit`, `weightKg` | ✅ Works                                          |
| D2  | Rider checks all item checkboxes            | Each checkbox toggles state, `allItemsChecked` becomes true               | ✅ Works                                          |
| D3  | All items checked → Phase transition modal  | "Phase 1 complete" modal shows for 1.2s, then switches to Phase 2         | ✅ Works                                          |
| D4  | Map switches to buyer's delivery address    | Destination pin moves from farmer to buyer location                       | ✅ Works (destination recomputed on phase change) |
| D5  | Phase 2 pill becomes active                 | "Phase 2: Going to Buyer" highlighted                                     | ✅ Works                                          |
| D6  | "TAKE PHOTO OF PRODUCE" button              | Button renders but photo capture not yet wired                            | ⚠️ UI only — no storage backend                   |
| D7  | ~~OTP verification at pickup~~              | ~~Farmer shares OTP, rider enters it~~                                    | ❌ Not implemented — future feature               |
| D8  | ~~Product quantity/quality mismatch~~       | ~~Rider flags issue, buyer notified~~                                     | ❌ Not implemented — future feature               |
| D9  | ~~Farmer not available at pickup~~          | ~~Rider reports, system offers retry/cancel~~                             | ❌ Not implemented — future feature               |

### Section E: Rider Delivers to Buyer (Delivery Phase)

| #   | Test Case                               | Expected Result                                                                      | Status                              |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| E1  | Map shows route from farmer to buyer    | Polyline from pickup coordinates to delivery coordinates                             | ✅ Works (RoutingController)        |
| E2  | Buyer's name and phone in top bar       | Header shows `order.delivery.buyerName` and `buyerPhone`                             | ✅ Works                            |
| E3  | Delivery address shown in bottom sheet  | Street, barangay, city, province from `order.delivery.address`                       | ✅ Works                            |
| E4  | Buyer's note to rider displayed         | `order.delivery.noteToRider` text shown                                              | ✅ Works                            |
| E5  | "TAKE PHOTO OF DELIVERY" button         | Button renders but photo capture not yet wired                                       | ⚠️ UI only — no storage backend     |
| E6  | Status update to `delivered` via API    | `PATCH /api/rider/orders/{id}/status` with `{status: "delivered"}` → wallet credited | ✅ Tested (unit + feature)          |
| E7  | Wallet balance increases after delivery | `rider_wallets.available_balance` increases by `rider_net` amount                    | ✅ Tested                           |
| E8  | Wallet transaction record created       | `rider_wallet_transactions` row with type=`earnings`, status=`completed`             | ✅ Tested                           |
| E9  | ~~OTP verification at delivery~~        | ~~Buyer shares OTP, rider enters it~~                                                | ❌ Not implemented — future feature |
| E10 | ~~Buyer not available at delivery~~     | ~~Rider reports, options: reschedule, leave with neighbor~~                          | ❌ Not implemented — future feature |
| E11 | ~~Product damaged during transit~~      | ~~Rider/buyer reports, dispute flow~~                                                | ❌ Not implemented — future feature |

### Section F: Post-Delivery & Payment

| #   | Test Case                                         | Expected Result                                                                          | Status                                         |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| F1  | Payment split calculated correctly                | `order_financials`: farmer_net (75% produce), rider_net (90% shipping), platform_revenue | ✅ Tested                                      |
| F2  | COD amount displayed on order card                | `codAmount` shows for COD orders, null for GCash                                         | ✅ Works                                       |
| F3  | Order moves to "Delivered" tab on RiderOrdersPage | Delivered orders appear in the Delivered tab                                             | ✅ Works                                       |
| F4  | Wallet page shows updated balance                 | `GET /api/rider/wallet` returns new `available_balance`                                  | ✅ Works                                       |
| F5  | Weekly earnings chart updates                     | New earnings appear in the weekly bar chart                                              | ✅ Works                                       |
| F6  | Recent payouts list shows new transaction         | New payout appears at top of recent payouts                                              | ✅ Works                                       |
| F7  | Profile stats update (total deliveries)           | `GET /api/rider/profile` returns incremented `total_deliveries`                          | ✅ Works                                       |
| F8  | ~~Buyer rates rider~~                             | ~~Rating submitted, confirmation shown~~                                                 | ❌ Not implemented — future feature            |
| F9  | ~~Buyer reports issue with product~~              | ~~Issue category selected, submitted to support~~                                        | ⚠️ Ticket system exists but not rider-specific |
| F10 | ~~Cash on delivery: rider collects cash~~         | ~~Order marked "Completed • Paid by Cash"~~                                              | ❌ Collection confirmation not implemented     |

### Section G: Cancellation Scenarios

| #   | Test Case                                | Expected Result                                                    | Status                                              |
| --- | ---------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| G1  | Rider cancels order (status → cancelled) | `PATCH /api/rider/orders/{id}/status` with `{status: "cancelled"}` | ✅ Works (minimal)                                  |
| G2  | Cancelled order moves to correct tab     | Cancelled orders excluded from "All" tab, visible in API response  | ✅ Works                                            |
| G3  | Cancelled order doesn't credit wallet    | No wallet transaction created for cancelled orders                 | ✅ Tested                                           |
| G4  | ~~Buyer cancels before rider accepts~~   | ~~Order cancelled, full refund~~                                   | ⚠️ Buyer cancellation exists but not rider-specific |
| G5  | ~~Buyer cancels after rider accepts~~    | ~~Rider notified, partial fee?~~                                   | ❌ Not implemented for rider flow                   |
| G6  | ~~Farmer cancels (product unavailable)~~ | ~~Buyer notified, full refund, rider reassigned~~                  | ❌ Not implemented for rider flow                   |

---

## Phase 3: GPS & Real-Time Testing

| #   | Test Scenario                             | How to Test                                      | Expected Result                                                         | Status                         |
| --- | ----------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------ |
| R1  | Map renders with destination pin          | Open ActiveDeliveryPage                          | Map visible, green pin (pickup) or red pin (delivery) at correct coords | ✅ Fixed                       |
| R2  | Route polyline draws on map               | Wait for `POST /api/routing/directions` response | Blue polyline from rider to destination                                 | ✅ Fixed                       |
| R3  | ETA badge shows time + distance           | Read ETA on map overlay                          | Shows `X min` and `Y km`, updates as route loads                        | ✅ Works                       |
| R4  | Turn-by-turn card shows instructions      | Read card at top of map                          | Shows next maneuver instruction + road name                             | ✅ Works                       |
| R5  | Rider GPS pin appears on map              | Allow location permissions on device             | Blue circle with motorcycle icon at rider's location                    | ✅ Works (requires real GPS)   |
| R6  | Rider pin moves on map                    | Use GPS mock app, move location                  | Pin updates position every 3-5 seconds                                  | ⚠️ Requires device GPS mocking |
| R7  | ETA decreases as rider approaches         | Move closer to destination via GPS mock          | ETA value decreases over time                                           | ⚠️ Requires device GPS mocking |
| R8  | ~~Buyer sees rider pin in real-time~~     | ~~Open buyer tracking screen~~                   | ❌ Buyer-side live tracking not implemented — future feature            |
| R9  | ~~Push notifications fire at each stage~~ | ~~Monitor notification shade~~                   | ❌ No FCM/APNS — future feature                                         |
| R10 | ~~GPS drift compensation~~                | ~~Simulate GPS jumping 50-200m~~                 | ❌ Not implemented — future feature                                     |
| R11 | ~~Offline action recovery~~               | ~~Disable network during pickup~~                | ❌ Not implemented — future feature                                     |
| R12 | App survives background/foreground switch | Switch to phone call mid-delivery, return        | App returns to correct state, GPS tracking resumes                      | ⚠️ Requires device testing     |

---

## Phase 4: Performance Testing

| Test Area                | Description                                       | Tool                    | Priority                                     |
| ------------------------ | ------------------------------------------------- | ----------------------- | -------------------------------------------- |
| API response time        | `GET /api/rider/orders` under load                | Postman, JMeter         | Medium                                       |
| Routing proxy latency    | `POST /api/routing/directions` response time      | Manual monitoring       | High — OSRM demo is rate-limited (1 req/sec) |
| Wallet query performance | `GET /api/rider/wallet` with 100+ transactions    | Artisan tinker          | Low                                          |
| App memory               | Rider app running 6-8 hours continuously          | Android Profiler        | High — riders work full shifts               |
| Battery usage            | GPS tracking + map rendering for extended periods | Android Battery Monitor | High                                         |
| Network switching        | Rider moves between 4G/Wi-Fi zones                | Manual testing          | Medium                                       |

> **Note:** OSRM demo server (`router.project-osrm.org`) is rate-limited to 1 req/sec. For production load testing, self-host an OSRM instance.

---

## Phase 5: Security Testing

| Test Area                    | Description                                              | Status                        |
| ---------------------------- | -------------------------------------------------------- | ----------------------------- |
| API authentication           | All `/api/rider/*` endpoints require valid Sanctum token | ✅ Tested (401 without token) |
| Rider role verification      | Non-rider users get 403 on rider endpoints               | ✅ Tested                     |
| Order ownership              | Rider can't access another rider's orders                | ✅ Tested (404)               |
| Status transition validation | Invalid transitions rejected with 422                    | ✅ Tested                     |
| Payment data protection      | PayMongo handles payment — no card data on our servers   | ✅ Existing                   |
| ~~OTP security~~             | ~~OTPs expire, can't be brute-forced~~                   | ❌ Not implemented — future   |
| Phone number privacy         | Farmer/buyer phone shown to rider — no masking           | ⚠️ Consider masking in future |
| Session management           | Tokens expire after 60 days, invalidated on logout       | ✅ Existing                   |

---

## Phase 6: Usability & Field Testing

| Test Area                    | Description                                                      | Notes                                                                                        |
| ---------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Rider app simplicity         | Can a rider with basic smartphone skills complete the full flow? | Test with non-technical users                                                                |
| Button tap targets           | All buttons ≥44pt, tappable while wearing gloves                 | Verify per Apple HIG / Material guidelines                                                   |
| Map readability              | Map pins, route, ETA visible in bright sunlight                  | Test outdoors in Pampanga                                                                    |
| Language support             | App in Tagalog or Kapampangan                                    | Language selector exists in RiderProfile (English/Tagalog/Kapampangan) — verify translations |
| Address input                | Can buyers use landmark-based addresses?                         | `landmarkNote` field exists in address schema                                                |
| Real-world field test        | Send actual riders on real pickup-delivery routes                | UAT phase — before major release                                                             |
| Rural GPS accuracy           | Farm locations may have poor GPS signal                          | Test geofencing tolerance — currently no geofence, manual status updates                     |
| Network drops in rural areas | App MUST handle gracefully                                       | ❌ Offline support not implemented — test failure mode (error states, not crashes)           |

---

## Phase 7: Edge Cases Specific to Farm-to-Buyer

| #   | Scenario                                                         | Expected Handling                                                           | Status                                                              |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| E1  | Farmer's product spoiled/rotten at pickup                        | Rider flags, buyer cancels or accepts partial                               | ❌ Not implemented — future                                         |
| E2  | Product weight differs from order (ordered 10kg, farmer has 8kg) | Weight Reconciliation Service recalculates price                            | ✅ Exists (seller-triggered, not rider)                             |
| E3  | Multiple products from one farmer                                | Rider collects all items, single pickup confirmation                        | ✅ Works — one-farmer-per-checkout means all items from same farmer |
| E4  | ~~Multiple farmers → single buyer~~                              | ~~Route optimized, sequential pickups~~                                     | ❌ Blocked — one-farmer-per-checkout is V1.0 rule                   |
| E5  | Perishable product with time constraint                          | ETA must account for shelf life                                             | ❌ Not implemented — future                                         |
| E6  | Bad road / impassable route to farm                              | Rider reports, system offers alternate route                                | ❌ Not implemented — future                                         |
| E7  | Buyer wants to inspect product before accepting                  | Allow inspection window before confirmation                                 | ❌ Not implemented — future                                         |
| E8  | Delivery fee is ₱0.00 (edge case)                                | Resource falls back to `order_financials.shipping_fee`, then to ₱60 default | ✅ Fixed                                                            |
| E9  | Order has no buyer_address_id (legacy order)                     | `buyerAddress` is null → delivery coords fall back to default               | ⚠️ Known — seeder ensures addresses exist                           |
| E10 | Seller has no latitude/longitude                                 | Pickup coords fall back to `15.0319, 120.6894` (San Fernando)               | ⚠️ Known — seeder ensures coordinates exist                         |

---

## Test Strategy Summary

```
Layer 1: API Tests (Backend) — ✅ 19 tests passing
  → RiderOrderServiceTest: 6 unit tests (accept, transitions, wallet, stats)
  → RiderControllerTest: 13 feature tests (all endpoints, auth, ownership)
  → Run on every code commit/PR

Layer 2: Functional E2E Tests (UI) — Manual
  → Full flow: Login → Accept order → Pickup → Deliver → Verify wallet
  → Test on 3-5 real Android devices
  → Run on every build

Layer 3: GPS & Real-Time Tests — Manual
  → Map rendering, pin movement, ETA updates
  → Use GPS simulation (Android mock locations)
  → Run before each release

Layer 4: Field Testing (Manual) — UAT
  → Real riders, real farmers, real buyers on actual routes in Pampanga
  → Focus on rural connectivity, GPS accuracy, usability
  → Run before major releases
```

---

## Future Features (Not Yet Testable)

These features are referenced in the original draft but not yet implemented. They should be tracked separately and added to this plan when built:

| Feature                                 | Priority | Dependencies                                 |
| --------------------------------------- | -------- | -------------------------------------------- |
| OTP verification (pickup + delivery)    | High     | SMS or in-app OTP generation                 |
| Push notifications (FCM/APNS)           | High     | Firebase setup, APNS certificates            |
| Photo upload (proof of pickup/delivery) | Medium   | Storage column + file upload endpoint        |
| Rider declines order                    | Medium   | Decline endpoint + re-assignment logic       |
| Rider rating system                     | Medium   | New table + review flow                      |
| Offline sync/queue                      | Low      | Local storage + sync conflict resolution     |
| Auto-assignment (rider pool)            | Low      | Geospatial query + notification service      |
| COD collection confirmation             | Medium   | Status field + UI confirmation               |
| GPS geofencing (auto "arrived")         | Low      | Geofence radius config + background location |
| Weight mismatch flagging by rider       | Low      | New endpoint + notification                  |

---

## Key Challenges for Sagana

1. **Rural GPS inaccuracy:** Farm locations in Pampanga may have poor GPS signal — test with tolerance and manual override (currently manual status updates only)
2. **Network drops in rural areas:** Rider app currently shows error states (not crashes) but doesn't queue actions offline — offline sync is a future feature
3. **OSRM rate limiting:** The routing proxy uses the public OSRM demo server (1 req/sec) — self-host OSRM for production
4. **Payment complexity:** 3-way split (buyer → farmer for product + rider/platform for delivery) is implemented in `order_financials` but COD collection by rider is not confirmed in-app
5. **One-farmer-per-checkout:** This V1.0 rule means every order has exactly one pickup and one delivery — simplifies the flow but blocks multi-pickup testing
