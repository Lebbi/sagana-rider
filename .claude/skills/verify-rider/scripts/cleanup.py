"""Tear down what a verification run started. Never kills by process name, and never touches evidence.

Usage:
    python .claude/skills/verify-rider/scripts/cleanup.py [--reset-db]

- Stops the Expo web server listening on port 8081, but only if it is a node process.
- Stops the backend app, nginx, and redis containers that the verify override started.
  The postgres container is left running: it was already running before the run and it hosts the dev DB.
- --reset-db drops the disposable sagana_verify database. Without it the seeded data is kept for the next run.
- Evidence in ~/.sagana-verify/evidence/ is never removed.
"""

import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[4].parent / "sagana-backend"
OVERRIDE = Path(__file__).resolve().parent / "backend.verify.yml"
EXPO_PORT = 8081
VERIFY_DB = "sagana_verify"


def listener_pid(port: int) -> str | None:
    out = subprocess.run(["netstat", "-ano"], capture_output=True, text=True).stdout
    for line in out.splitlines():
        parts = line.split()
        if len(parts) >= 5 and parts[0] == "TCP" and parts[1].endswith(f":{port}") and parts[3] == "LISTENING":
            return parts[4]
    return None


def image_name(pid: str) -> str:
    out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
                         capture_output=True, text=True).stdout.strip()
    return out.split(",")[0].strip('"').lower() if out else ""


def stop_expo() -> None:
    pid = listener_pid(EXPO_PORT)
    if not pid:
        print(f"expo: nothing listening on {EXPO_PORT}")
        return
    if image_name(pid) != "node.exe":
        print(f"expo: PID {pid} on {EXPO_PORT} is not node.exe; leaving it alone")
        return
    subprocess.run(["taskkill", "/PID", pid, "/T", "/F"], capture_output=True)
    print(f"expo: stopped node PID {pid} on {EXPO_PORT}")


def stop_containers() -> None:
    subprocess.run(
        ["docker", "compose", "-f", "docker-compose.yml", "-f", str(OVERRIDE), "stop", "app", "nginx", "redis"],
        cwd=BACKEND, capture_output=True, text=True,
    )
    print("containers: stopped app, nginx, redis (postgres left running)")


def reset_db() -> None:
    subprocess.run(
        ["docker", "exec", "sagana-backend-postgres", "psql", "-U", "sagana_user", "-d", "postgres",
         "-c", f"DROP DATABASE IF EXISTS {VERIFY_DB} WITH (FORCE)"],
        capture_output=True, text=True,
    )
    print(f"database: dropped {VERIFY_DB}")


def main() -> int:
    stop_expo()
    stop_containers()
    if "--reset-db" in sys.argv:
        reset_db()
    print("cleanup done; evidence kept in ~/.sagana-verify/evidence/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
