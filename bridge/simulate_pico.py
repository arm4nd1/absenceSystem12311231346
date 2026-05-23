"""
Pico W2 Simulator
=================
Simulates the Pico sending JSON events directly to the bridge's HTTP API.
Use this to test the full stack WITHOUT physical hardware.

Run INSTEAD of bridge.py (or alongside it if you want to test serial too):
  python simulate_pico.py

It will:
  1. Open a session for a subject you specify
  2. Send fake fingerprint scans every few seconds
  3. Let you trigger events interactively via the menu
"""

import sys
import time
import json
import random
import requests
import threading

BRIDGE_URL  = "http://localhost:5050"
BACKEND_URL = "http://localhost:4000/api"

# ── Helpers ───────────────────────────────────────────────────────────────────

def post(url, body=None):
    try:
        r = requests.post(url, json=body or {}, timeout=3)
        return r.json()
    except Exception as e:
        return {"error": str(e)}

def get(url):
    try:
        r = requests.get(url, timeout=3)
        return r.json()
    except Exception as e:
        return {"error": str(e)}

# ── Bridge direct-inject: push fake scan events ───────────────────────────────

def fake_scan(fp_id: int, score: int = 85):
    """POST a fake scan event to the bridge's /simulate-scan endpoint."""
    print(f"  [SIM] Sending scan: fp_id={fp_id} score={score}")
    result = post(f"{BRIDGE_URL}/simulate-scan", {"fp_id": fp_id, "score": score})
    print(f"  [SIM] simulate-scan → {result}")

def open_session_on_bridge(subject_id: str):
    result = post(f"{BRIDGE_URL}/session/open", {"subjectId": subject_id})
    print(f"  [BRIDGE] open_session → {result}")

def close_session_on_bridge():
    result = post(f"{BRIDGE_URL}/session/close")
    print(f"  [BRIDGE] close_session → {result}")

def bridge_status():
    result = get(f"{BRIDGE_URL}/status")
    print(f"  [BRIDGE] status → {result}")

# ── Auto-scan thread ──────────────────────────────────────────────────────────

_auto_running = False
_fp_ids = []

def auto_scan_thread(interval: float):
    global _auto_running
    while _auto_running:
        if _fp_ids:
            fp_id = random.choice(_fp_ids)
            score = random.randint(70, 100)
            print(f"\n  [AUTO-SCAN] fp_id={fp_id} score={score}")
            fake_scan(fp_id, score)
        time.sleep(interval)

# ── Interactive menu ──────────────────────────────────────────────────────────

def menu():
    global _auto_running, _fp_ids
    print("\n" + "="*52)
    print("  Pico W2 Simulator - AttendFP")
    print("="*52)
    print("  Make sure bridge.py is running first!\n")

    while True:
        print("\n  1. Check bridge status")
        print("  2. Open session (enter subject ID)")
        print("  3. Close session")
        print("  4. Enroll fingerprint slot")
        print("  5. Start auto-scan (random fp_ids)")
        print("  6. Stop auto-scan")
        print("  7. Manually inject scan event (via bridge HTTP)")
        print("  q. Quit")
        choice = input("\n  > ").strip().lower()

        if choice == "1":
            bridge_status()

        elif choice == "2":
            sid = input("  Subject ID: ").strip()
            open_session_on_bridge(sid)

        elif choice == "3":
            close_session_on_bridge()

        elif choice == "4":
            fp_id = int(input("  Fingerprint slot (0-127): ").strip())
            result = post(f"{BRIDGE_URL}/enroll", {"fp_id": fp_id})
            print(f"  [BRIDGE] enroll → {result}")

        elif choice == "5":
            raw = input("  fp_ids to cycle (comma-separated, e.g. 1,2,3): ").strip()
            _fp_ids = [int(x) for x in raw.split(",") if x.strip().isdigit()]
            interval = float(input("  Interval seconds (e.g. 5): ").strip() or "5")
            _auto_running = True
            t = threading.Thread(target=auto_scan_thread, args=(interval,), daemon=True)
            t.start()
            print(f"  Auto-scan started for fp_ids={_fp_ids} every {interval}s")

        elif choice == "6":
            _auto_running = False
            print("  Auto-scan stopped.")

        elif choice == "7":
            fp_id = int(input("  fp_id: ").strip())
            score = int(input("  score (50-100): ").strip() or "90")
            fake_scan(fp_id, score)

        elif choice == "q":
            _auto_running = False
            print("  Bye!")
            sys.exit(0)

if __name__ == "__main__":
    menu()
