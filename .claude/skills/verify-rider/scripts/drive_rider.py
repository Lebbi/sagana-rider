"""Drive the Sagana Rider app (Expo web build) the way a rider would, and capture evidence.

Usage:
    python .claude/skills/verify-rider/scripts/drive_rider.py [--feature login-and-orders]

Requires the Expo web server on http://localhost:8081 and the backend on http://localhost:8000
(see SKILL.md, Launch). Evidence is written to ~/.sagana-verify/evidence/rider/<run-id>/.
"""

import argparse
import datetime as dt
import json
import pathlib
import sys
import time

from playwright.sync_api import sync_playwright, expect

WEB = "http://localhost:8081"
API_HOST = "localhost:8000"
RIDER_EMAIL = "carlos.rider@sagana.local"
RIDER_PASSWORD = "Password123!"


def type_until_sticks(locator, text: str, attempts: int = 8) -> None:
    """Type into a field and confirm its value; retry while React is still hydrating."""
    for _ in range(attempts):
        locator.click()
        locator.press_sequentially(text, delay=20)
        if locator.input_value() == text:
            return
        locator.fill("")
        time.sleep(1)
    raise RuntimeError(f"input did not accept text after {attempts} attempts")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--feature", default="login-and-orders")
    args = parser.parse_args()

    run_id = dt.datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + args.feature
    out = pathlib.Path.home() / ".sagana-verify" / "evidence" / "rider" / run_id
    out.mkdir(parents=True, exist_ok=True)

    api_calls: list[dict] = []
    api_status: list[dict] = []
    foreign_calls: list[str] = []
    steps: list[dict] = []

    def record(name: str, ok: bool, detail: str = "") -> None:
        steps.append({"step": name, "ok": ok, "detail": detail})
        print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})

        def on_request(req):
            url = req.url
            if "/api/" in url:
                api_calls.append({"method": req.method, "url": url})
                if API_HOST not in url:
                    foreign_calls.append(url)

        page.on("request", on_request)
        page.on("response", lambda r: api_status.append({"status": r.status, "url": r.url}) if "/api/" in r.url else None)

        # 1. Login through the real form.
        page.goto(f"{WEB}/login", wait_until="networkidle", timeout=180_000)
        # The Expo dev error toast (#error-toast) is an empty, absolutely positioned container that
        # intercepts clicks on the tab bar. Let clicks through; the toast stays visible in screenshots.
        page.add_style_tag(content="#error-toast{pointer-events:none!important}")
        # The static HTML already shows the form, but React has not attached handlers yet.
        # Type until the value sticks, and click until the route changes, so the run does not
        # depend on hydration timing.
        type_until_sticks(page.locator("input").nth(0), RIDER_EMAIL)
        type_until_sticks(page.locator("input").nth(1), RIDER_PASSWORD)
        page.screenshot(path=str(out / "01-login-filled.png"))

        try:
            for _ in range(4):
                page.get_by_label("Log in", exact=True).click()
                try:
                    page.wait_for_url("**/tabs**", timeout=15_000)
                    break
                except Exception:  # noqa: BLE001 - retry the click; hydration may still be settling
                    continue
            else:
                raise TimeoutError("login did not navigate to /tabs after 4 clicks")
            record("login reaches /tabs", True, page.url)
        except Exception as exc:  # noqa: BLE001 - evidence matters more than the exception type
            record("login reaches /tabs", False, str(exc).splitlines()[0])
            page.screenshot(path=str(out / "02-login-failed.png"))
            browser.close()
            return finish(out, run_id, steps, api_calls, api_status, foreign_calls, 1)

        page.wait_for_load_state("networkidle")
        page.screenshot(path=str(out / "02-home.png"))

        # 2. Open the Orders tab. Tabs are routes (app/tabs/RiderOrdersPage.tsx), so assert the URL.
        page.get_by_text("Orders", exact=True).first.click()
        try:
            page.wait_for_url("**/RiderOrdersPage**", timeout=20_000)
            # Proof is the data, not the route: the spinner must clear and a seeded order must render.
            expect(page.get_by_text("Loading orders...")).to_have_count(0, timeout=60_000)
            expect(page.get_by_text("Order #SG-7", exact=True).first).to_be_visible(timeout=15_000)
            page.screenshot(path=str(out / "03-orders.png"), full_page=True)
            record("orders list shows seeded order #SG-7", True, page.url)
        except Exception as exc:  # noqa: BLE001
            page.screenshot(path=str(out / "03-orders-failed.png"), full_page=True)
            record("orders list shows seeded order #SG-7", False, str(exc).splitlines()[0])

        # 3. Open the Wallet tab (app/tabs/RiderWalletPage.tsx).
        page.get_by_text("Wallet", exact=True).first.click()
        try:
            page.wait_for_url("**/RiderWalletPage**", timeout=20_000)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1500)
            page.screenshot(path=str(out / "04-wallet.png"), full_page=True)
            record("wallet tab renders", True, page.url)
        except Exception as exc:  # noqa: BLE001
            record("wallet tab renders", False, str(exc).splitlines()[0])

        browser.close()

    return finish(out, run_id, steps, api_calls, api_status, foreign_calls, 0 if all(s["ok"] for s in steps) else 1)


def finish(out, run_id, steps, api_calls, api_status, foreign_calls, code) -> int:
    # Side-effect check: every API call must go to the local backend, never production.
    if foreign_calls:
        steps.append({"step": "API calls stay on localhost", "ok": False, "detail": foreign_calls[:3]})
        print("FAIL API calls stay on localhost — " + ", ".join(foreign_calls[:3]))
        code = 1
    else:
        steps.append({"step": "API calls stay on localhost", "ok": True, "detail": f"{len(api_calls)} calls"})
        print(f"PASS API calls stay on localhost — {len(api_calls)} calls")

    (out / "report.json").write_text(
        json.dumps({"run": run_id, "steps": steps, "api_responses": api_status}, indent=2),
        encoding="utf-8",
    )
    print(f"evidence: {out}")
    return code


if __name__ == "__main__":
    sys.exit(main())
