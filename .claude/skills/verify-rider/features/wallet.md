# Wallet

Wallet lets a rider see the balance and earnings from delivered orders. The Wallet tab opens the wallet screen for the signed-in rider.

## Sub-features

- `wallet-tab` opens the Wallet route from the tab bar.
- `wallet-balance` shows the available balance and earnings (currently zero for the seeded rider; see Gotchas).

## How to get to it (user POV)

- Choose the `Wallet` item in the bottom tab bar on `/tabs`.

## Driving it with playwright

Preconditions:

- Signed in as `carlos.rider@sagana.local`.

- **Open tab.** Click the text `Wallet` (`get_by_text("Wallet", exact=True).first`). The URL becomes `/tabs/RiderWalletPage`.
- **Read the data.** `GET /api/rider/wallet` returns 200 with `available_balance`, `pending_balance`, `total_earnings`, `weekly_earnings`, and `recent_earnings`.
- **Proof.** Screenshot `04-wallet.png` shows the Wallet screen.

## Gotchas

- The current driver asserts on the route only. Extend it to assert on a rendered balance before treating this feature as fully proven.
- The seeded rider's wallet returns zero balances and empty earnings lists. A non-zero assertion needs a seeded earning or a fixture change; do not weaken the check to pass on zeros.
- Clicking `Wallet` while the dev toast is up is blocked the same way as `Orders`. See `orders.md` Gotchas.
