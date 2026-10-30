---
name: verify-rider
description: Drive the Sagana Rider Expo app (web build) against a local backend to prove rider sign-in, the Orders list, and the Wallet tab work. Use when asked to verify, prove, or check a rider-app change in the running app, or to show that a change works for a rider. Covers the local Docker backend stack, Expo web on port 8081, and a Playwright driver that captures screenshots and API responses.
---

# Verify Sagana Rider

This skill drives the real rider app the way a rider would: it opens the web build, signs in through the form, opens tabs, and checks the seeded data renders. It runs against a local backend, never the Render production API.

Run every command from `sagana-rider/` unless a step says otherwise.

## Launch

1. **Backend stack.** From `../sagana-backend`, start the app, nginx, redis, and postgres with the verify override. The override points the app at the disposable `sagana_verify` database so the dev `sagana` database is never touched:

   ```bash
   cd ../sagana-backend && docker compose -f docker-compose.yml -f ../sagana-rider/.claude/skills/verify-rider/scripts/backend.verify.yml up -d --build app nginx redis postgres
   cd ../sagana-rider
   ```

2. **Verification database.** Create it once. "already exists" is fine:

   ```bash
   docker exec sagana-backend-postgres psql -U sagana_user -d postgres -c "CREATE DATABASE sagana_verify"
   ```

3. **Migrate and seed.** Run only when the doctor's login check returns 401, which means the seeded rider is missing:

   ```bash
   docker exec sagana-backend-app php artisan migrate --force
   docker exec sagana-backend-app php artisan db:seed --force
   ```

4. **Expo web.** Start the rider app against the local API. The first bundle takes about 2.5 minutes. Run it in the background and log to `~/.sagana-verify/logs/`:

   ```bash
   EXPO_PUBLIC_API_URL=http://localhost:8000 CI=1 npx expo start --web --port 8081 > ~/.sagana-verify/logs/expo-web.log 2>&1 &
   ```

   Wait until `curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/login` returns `200`.

Ready means usable, not just listening. Run the doctor before driving.

## Doctor

Read-only except for one login that creates a token in the disposable database:

```bash
python .claude/skills/verify-rider/scripts/doctor.py
```

It checks that the backend container runs, that it points at `sagana_verify`, that the API accepts the seeded rider, and that Expo web serves `/login`. Every check must PASS before you drive. If one fails, fix that step in Launch and rerun. Do not drive a stack the doctor reports as NOT READY.

## Drive

```bash
python .claude/skills/verify-rider/scripts/drive_rider.py
```

This runs the three features in `features/`: sign in, the Orders list, and the Wallet tab. The script exits 0 only when every step passes. Read the feature file for the user path, the exact selectors, and the traps before you change the driver.

To cover a new feature, add a feature file under `features/` in the four-section shape from `features/README.md`, then extend the driver.

## Evidence

Each run writes to `~/.sagana-verify/evidence/rider/<run-id>/`:

- `01-login-filled.png`, `02-home.png`, `03-orders.png`, `04-wallet.png`: screenshots of the user path.
- `report.json`: every step with PASS or FAIL, and every API response with its status.

Failed runs also write a screenshot named `*-failed.png`. Cite the run folder and the screenshots when you report a result. Never report a pass from the URL alone; the Orders check asserts on seeded data (`Order #SG-7`) for that reason.

## Cleanup

Run this after every run, including failed ones:

```bash
python .claude/skills/verify-rider/scripts/cleanup.py          # keep the seeded database for the next run
python .claude/skills/verify-rider/scripts/cleanup.py --reset-db  # also drop sagana_verify
```

Cleanup stops only what this run started: the Expo node process on port 8081 and the app, nginx, and redis containers. It leaves the postgres container running because it hosts the dev database and was running before the run. It never removes evidence in `~/.sagana-verify/evidence/`.

## Gotchas

- **Never point the app at production.** `sagana-rider/.env.local` sets `EXPO_PUBLIC_API_URL` to `https://sagana-api.onrender.com`. The driver fails if any API call leaves `localhost`, but always pass `EXPO_PUBLIC_API_URL=http://localhost:8000` on the Expo command.
- **Login is throttled** to 10 requests per minute. Reruns in quick succession return 429.
- **Hydration.** The static HTML shows the login form before React attaches handlers. The driver types until the values stick and retries the click.
- **Dev toast.** The Expo dev error toast (`#error-toast`) sits over the tab bar and blocks clicks. The driver lets clicks through it and keeps it visible in screenshots.
- **Nested-button warning.** A dev-build toast reads "`<button>` cannot contain a nested `<button>`". It is a React DOM warning, not a failure of the features above.
- **Dirty backend repo.** `sagana-backend` has uncommitted changes. This skill does not commit, reset, or edit the backend.
- **The first login in a session may seed a token** in the verify database. That is expected.

## Stand-in notes

This verifies the local stack: a Docker Postgres and a local Laravel app. The production target runs on Render with a different database, real SMTP, and the production API URL. Steps that depend on those are not verified by this skill:

- Production deploy configuration and environment variables on Render.
- Real email delivery (signup OTP uses SMTP settings in `.env`).
- The production database contents and any production-only seed data.
- Native builds. The driver runs the Expo web build only, not the iOS or Android app.
