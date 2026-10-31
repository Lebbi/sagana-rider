# Orders

Orders lets a rider review the delivery orders assigned to them, filter them by status, and open one. The All tab lists every order, including `searching` orders the rider can accept.

## Sub-features

- `orders-list` shows the rider's orders with order number, date, and shipping fee.
- `orders-filter` switches between All, New, Processing, Delivered, and Pasabay.
- `orders-loading` shows a spinner until the list arrives, then clears it.

## How to get to it (user POV)

- Choose the `Orders` item in the bottom tab bar on `/tabs`.

## Driving it with playwright

Preconditions:

- Signed in as `carlos.rider@sagana.local` (see `sign-in.md`).
- Seeded orders exist. `RiderOrderSeeder` assigns searching orders to Carlos. `Order #SG-7` is one of them.

- **Open tab.** Click the text `Orders` (`get_by_text("Orders", exact=True).first`). The URL becomes `/tabs/RiderOrdersPage`.
- **Wait for data.** The text `Loading orders...` must disappear. Calls to `GET /api/rider/orders` return 200.
- **Proof of data.** The text `Order #SG-7` (exact) is visible. Screenshot `03-orders.png` shows the list.

## Gotchas

- The list loads after the route change, so asserting on the URL alone passes even when the data never renders. Assert on the seeded order text.
- The title text is `Order #SG-7` in a single text node. `get_by_text("#SG-7")` with `exact=True` does not match.
- The Expo dev error toast (`#error-toast`) is an empty absolutely positioned container that sits over the tab bar and intercepts clicks on `Orders` and `Wallet`. `drive_rider.py` sets `pointer-events:none` on it so clicks reach the tabs. Do not hide the screen with it.
- The dev build shows a toast reading "`<button>` cannot contain a nested `<button>`". That is a React DOM nesting warning from a dev build. Log it as an observation; it is not a failure of this feature.
