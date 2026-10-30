"""Read-only check: is the local Sagana Rider verification stack worth driving?

Usage:
    python .claude/skills/verify-rider/scripts/doctor.py

Exits 0 only when every check passes. Nothing here writes data; the login check creates an
API token in the isolated sagana_verify database, which is disposable.
"""

import json
import subprocess
import sys
import urllib.error
import urllib.request

API = "http://localhost:8000/api"
WEB = "http://localhost:8081"
BACKEND_CONTAINER = "sagana-backend-app"
VERIFY_DB = "sagana_verify"
RIDER = {"email": "carlos.rider@sagana.local", "password": "Password123!"}


def check(name: str, ok: bool, detail: str = "") -> bool:
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))
    return ok


def http_status(url: str, method: str = "GET", body: dict | None = None) -> int:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Accept": "application/json", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code
    except OSError:
        return 0


def docker_env(name: str) -> str:
    out = subprocess.run(["docker", "exec", BACKEND_CONTAINER, "printenv", name],
                         capture_output=True, text=True)
    return out.stdout.strip() if out.returncode == 0 else ""


def main() -> int:
    results = []

    # Backend container is running and bound to the verification database.
    running = subprocess.run(["docker", "inspect", "-f", "{{.State.Running}}", BACKEND_CONTAINER],
                             capture_output=True, text=True).stdout.strip() == "true"
    results.append(check("backend app container running", running, BACKEND_CONTAINER))
    db = docker_env("DB_DATABASE")
    results.append(check("backend points at the verification database", db == VERIFY_DB,
                         f"DB_DATABASE={db or 'unset'}"))

    # API answers and a seeded rider can log in against it.
    status = http_status(f"{API}/rider/login", "POST", RIDER)
    results.append(check("API rider login returns 200", status == 200, f"HTTP {status}"))

    # Expo web is serving the rider app.
    web = http_status(WEB + "/login")
    results.append(check("Expo web serves /login", web == 200, f"HTTP {web}"))

    passed = all(results)
    print("doctor: OK — safe to drive" if passed else "doctor: NOT READY — see SKILL.md Launch")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
