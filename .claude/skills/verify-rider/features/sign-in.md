# Sign in

Sign in lets a rider log in with email and password and reach the tab shell. A wrong password shows an error and keeps the rider on the form.

## Sub-features

- `signin-form` shows the email and password fields and the Log in button.
- `signin-success` logs a seeded rider in and routes to `/tabs`.
- `signin-invalid` rejects a wrong password without leaving `/login`.

## How to get to it (user POV)

- Open the app. The root route redirects a signed-out rider to `/login`.
- Open `/login` directly in the browser.

## Driving it with playwright

Preconditions:

- Expo web at `http://localhost:8081`, backend at `http://localhost:8000`, `doctor.py` PASS.
- `carlos.rider@sagana.local` exists with password `Password123!`.

- **Open form.** Navigate to `http://localhost:8081/login` and wait for network idle. The `Log in` button (`get_by_label("Log in", exact=True)`) is visible.
- **Wait for hydration.** The static HTML shows the form before React attaches handlers. Type into the fields until the value sticks (`type_until_sticks` in `drive_rider.py`). Typing once can be lost.
- **Enter credentials.** Email into `input` index 0, password into `input` index 1. Both inputs keep their values.
- **Submit.** Click `Log in`. Retry the click until the URL matches `**/tabs**`. The API call `POST /api/rider/login` returns 200.
- **Proof.** Screenshot `02-home.png` shows the tab bar. The API response log shows the login call against `localhost:8000`.

## Gotchas

- The login form is server-rendered before React hydrates, so a single `fill()` right after navigation can leave the state empty and the form shows "Please enter a valid email address". Verify the value sticks before submitting.
- `POST /api/rider/login` is throttled to 10 requests per minute per client. Repeated runs in a short window return 429. Wait a minute and rerun.
- An invalid password returns 401 with "Invalid credentials". The screen shows "Invalid email or password. Please try again."
- Rider accounts are created by Sagana, not self-service. There is no signup flow to verify.
