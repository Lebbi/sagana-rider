# Sagana Rider verification map

This directory is the maintained source for verifying what a rider does in the Sagana Rider app. Read the index before driving the app, then use the matching feature file as the recipe. The runnable driver is `scripts/drive_rider.py`; it covers all three features below in one run.

## Baseline preconditions

- Backend stack running with the verify override (see `../SKILL.md`, Launch). The app must point at the `sagana_verify` database.
- Expo web serving `http://localhost:8081` with `EXPO_PUBLIC_API_URL=http://localhost:8000`.
- Seeded rider `carlos.rider@sagana.local` / `Password123!` exists (from `RealisticFilipinoDataSeeder`).
- `doctor.py` reports every check PASS.
- Never drive an instance that was not started for this verification run, and never point the app at the Render production API.

## Driving conventions

- Start every recipe at the sign-in screen (`/login`) unless its preconditions say otherwise.
- Prefer accessible names (`get_by_label`, `get_by_text`) over CSS selectors or DOM position.
- Tabs are routes. Assert the URL (`/tabs/RiderOrdersPage`) and the rendered data, not the tab highlight alone.

## Proof and skip reporting

- Capture the user action and the resulting state: a screenshot of the populated screen plus the API responses that fed it.
- Mutation proof needs a read-only second view of the stored value.
- Record the feature ID and entry point with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with playwright`, `Gotchas`.

## Features

- [Sign in](./sign-in.md) covers the rider login form and the handoff to the tab shell.
- [Orders](./orders.md) covers the Orders tab list and its seeded data.
- [Wallet](./wallet.md) covers the Wallet tab route.
