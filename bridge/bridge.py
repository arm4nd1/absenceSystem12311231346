"""
Python Bridge – Pico W2  ←→  Firebase Firestore
================================================
Reads JSON lines from the Pico's bridge UART (over USB-serial or dedicated
UART adapter) and writes attendance records into Firestore.

It also drives the session_pin by exposing a tiny HTTP server so the backend
can open / close attendance sessions via:
  POST /session/open   {"subjectId": "..."}
  POST /session/close

Run:
  python bridge.py
"""

import os
import sys
import json
import time
import serial
import logging
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials, firestore

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv()

SERIAL_PORT        = os.getenv("SERIAL_PORT", "COM3")
SERIAL_BAUD        = int(os.getenv("SERIAL_BAUD", "115200"))
FIREBASE_CREDS     = os.getenv("FIREBASE_CREDENTIALS", "./serviceAccountKey.json")
FIREBASE_PROJECT   = os.getenv("FIREBASE_PROJECT_ID", "")
DUPLICATE_COOLDOWN = int(os.getenv("DUPLICATE_COOLDOWN", "30"))
HTTP_PORT          = int(os.getenv("BRIDGE_HTTP_PORT", "5050"))
# Unique ID for this bridge instance (used when running multiple Picos simultaneously).
# Each room's bridge should have a different BRIDGE_ID and BRIDGE_HTTP_PORT.
BRIDGE_ID          = os.getenv("BRIDGE_ID", "bridge-1")
ROOM_LABEL         = os.getenv("ROOM_LABEL", "Room 1")

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("bridge.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("bridge")

# ── Firebase init ─────────────────────────────────────────────────────────────
cred = credentials.Certificate(FIREBASE_CREDS)
firebase_admin.initialize_app(cred, {"projectId": FIREBASE_PROJECT})
db = firestore.client()

# ── Shared state ──────────────────────────────────────────────────────────────
state = {
    "active_subject_id": os.getenv("ACTIVE_SUBJECT_ID", ""),
    "session_open":      False,
    "session_doc_id":    None,
    "recent_scans":      {},   # fp_id → last scan timestamp (dedup)
}
state_lock = threading.Lock()


# ── Serial helpers ────────────────────────────────────────────────────────────

class _MockSerial:
    """Fake serial port used when running without a Pico (--no-serial / NO_SERIAL=1)."""
    def readline(self): time.sleep(0.5); return b""
    def write(self, data): log.debug(f"[MOCK serial TX] {data}")
    def any(self): return False
    def close(self): pass


def open_serial(port: str, baud: int, retries: int = 5):
    no_serial = os.getenv("NO_SERIAL", "0") == "1" or "--no-serial" in sys.argv
    if no_serial:
        log.warning("NO_SERIAL mode — running without a Pico. HTTP control server only.")
        return _MockSerial()
    for attempt in range(1, retries + 1):
        try:
            s = serial.Serial(port, baud, timeout=1)
            log.info(f"Serial port {port} opened at {baud} baud.")
            return s
        except serial.SerialException as exc:
            log.warning(f"Serial open attempt {attempt}/{retries} failed: {exc}")
            time.sleep(2)
    raise RuntimeError(f"Cannot open serial port {port} after {retries} attempts.")


def send_command(ser: serial.Serial, cmd: dict):
    line = json.dumps(cmd) + "\n"
    ser.write(line.encode())
    log.debug(f"→ Pico: {line.strip()}")


# ── Session management ────────────────────────────────────────────────────────

def open_session(subject_id: str, ser: serial.Serial):
    with state_lock:
        if state["session_open"]:
            log.warning("Session already open.")
            return False
        state["active_subject_id"] = subject_id
        state["session_open"]      = True
        state["recent_scans"]      = {}

    # Tell Pico to pull session_pin HIGH (we simulate via a command here;
    # in hardware you'd toggle a GPIO pin on the bridge MCU side if needed)
    send_command(ser, {"cmd": "session_open", "subject_id": subject_id})

    # Record session in Firestore
    now = datetime.now(timezone.utc)
    doc_ref = db.collection("sessions").document()
    doc_ref.set({
        "subjectId":  subject_id,
        "startTime":  now,
        "endTime":    None,
        "isActive":   True,
        "date":       now.strftime("%Y-%m-%d"),
    })
    with state_lock:
        state["session_doc_id"] = doc_ref.id
    log.info(f"Session opened for subject={subject_id}, doc={doc_ref.id}")
    return True


def close_session(ser: serial.Serial):
    with state_lock:
        if not state["session_open"]:
            log.warning("No session is open.")
            return False
        doc_id     = state["session_doc_id"]
        state["session_open"]   = False
        state["session_doc_id"] = None

    send_command(ser, {"cmd": "session_close"})

    if doc_id:
        db.collection("sessions").document(doc_id).update({
            "endTime":  datetime.now(timezone.utc),
            "isActive": False,
        })
    log.info("Session closed.")
    return True


# ── Attendance recording ──────────────────────────────────────────────────────

def record_attendance(fp_id: int, score: int):
    with state_lock:
        subject_id = state["active_subject_id"]
        if not subject_id:
            log.warning(f"Scan fp_id={fp_id} but no active subject.")
            return

        now_ts = time.time()
        last   = state["recent_scans"].get(fp_id, 0)
        if now_ts - last < DUPLICATE_COOLDOWN:
            log.info(f"Duplicate scan suppressed for fp_id={fp_id}")
            return
        state["recent_scans"][fp_id] = now_ts

    # Look up student by fingerprintId
    query = db.collection("students").where("fingerprintId", "==", fp_id).limit(1).stream()
    students = list(query)

    if not students:
        log.warning(f"No student found for fp_id={fp_id}")
        db.collection("unknown_scans").add({
            "fingerprintId": fp_id,
            "score":         score,
            "timestamp":     datetime.now(timezone.utc),
            "subjectId":     subject_id,
        })
        return

    student_doc  = students[0]
    student_id   = student_doc.id
    student_data = student_doc.to_dict()
    now          = datetime.now(timezone.utc)
    date_str     = now.strftime("%Y-%m-%d")

    # All fingerprint scans are recorded as "present".
    # Instructors manually change the status to "late" / "absent" via the dashboard.
    status = "present"

    att_ref = db.collection("attendance").document()
    att_ref.set({
        "studentId":     student_id,
        "studentName":   student_data.get("name", ""),
        "studentNumber": student_data.get("studentNumber", ""),
        "subjectId":     subject_id,
        "fingerprintId": fp_id,
        "score":         score,
        "timestamp":     now,
        "date":          date_str,
        "status":        status,
    })
    log.info(f"Attendance: student={student_data.get('name')} "
             f"fp_id={fp_id} subject={subject_id} status={status}")


# ── Serial reader thread ──────────────────────────────────────────────────────

def serial_reader(ser: serial.Serial):
    log.info("Serial reader thread started.")
    while True:
        try:
            raw = ser.readline()
            if not raw:
                continue
            line = raw.decode("utf-8", errors="ignore").strip()
            if not line:
                continue
            log.debug(f"← Pico: {line}")
            msg = json.loads(line)

            mtype = msg.get("type", "")

            if mtype == "ready":
                log.info("Pico reported READY.")

            elif mtype == "scan":
                fp_id = msg.get("fp_id", -1)
                score = msg.get("score", 0)
                log.info(f"Scan event: fp_id={fp_id} score={score}")
                threading.Thread(target=record_attendance,
                                 args=(fp_id, score), daemon=True).start()

            elif mtype == "no_match":
                log.info("No match for scanned fingerprint.")

            elif mtype in ("enroll_ok", "enroll_fail"):
                log.info(f"Enroll event: {msg}")
                db.collection("enroll_events").add({**msg,
                    "serverTime": datetime.now(timezone.utc)})

            elif mtype == "error":
                log.error(f"Pico error: {msg.get('reason')}")

        except json.JSONDecodeError:
            pass
        except serial.SerialException as exc:
            log.error(f"Serial error: {exc}")
            time.sleep(1)
        except Exception as exc:
            log.exception(f"Unexpected error in reader: {exc}")


# ── Tiny HTTP control server ──────────────────────────────────────────────────

_ser_ref = None  # set in main() before starting HTTP server


class BridgeHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        log.debug(fmt % args)

    def _json_response(self, code: int, body: dict):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/status":
            with state_lock:
                body = {
                    "sessionOpen":     state["session_open"],
                    "activeSubjectId": state["active_subject_id"],
                }
            self._json_response(200, body)
        else:
            self._json_response(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body   = json.loads(self.rfile.read(length)) if length else {}

        if self.path == "/session/open":
            subject_id = body.get("subjectId", "")
            if not subject_id:
                self._json_response(400, {"error": "subjectId required"})
                return
            ok = open_session(subject_id, _ser_ref)
            self._json_response(200 if ok else 409, {"ok": ok})

        elif self.path == "/session/close":
            ok = close_session(_ser_ref)
            self._json_response(200, {"ok": ok})

        elif self.path == "/enroll":
            fp_id = body.get("fp_id")
            if fp_id is None:
                self._json_response(400, {"error": "fp_id required"})
                return
            send_command(_ser_ref, {"cmd": "enroll", "fp_id": int(fp_id)})
            self._json_response(200, {"ok": True, "fp_id": fp_id})

        elif self.path == "/delete":
            fp_id = body.get("fp_id")
            if fp_id is None:
                self._json_response(400, {"error": "fp_id required"})
                return
            send_command(_ser_ref, {"cmd": "delete", "fp_id": int(fp_id)})
            self._json_response(200, {"ok": True})

        elif self.path == "/count":
            send_command(_ser_ref, {"cmd": "count"})
            self._json_response(200, {"ok": True, "note": "check serial log"})

        elif self.path == "/simulate-scan":
            fp_id = body.get("fp_id")
            score = body.get("score", 90)
            if fp_id is None:
                self._json_response(400, {"error": "fp_id required"})
                return
            with state_lock:
                if not state["session_open"]:
                    self._json_response(409, {"error": "No session is open. Open a session first."})
                    return
            log.info(f"[SIM] Injecting scan fp_id={fp_id} score={score}")
            threading.Thread(target=record_attendance,
                             args=(int(fp_id), int(score)), daemon=True).start()
            self._json_response(200, {"ok": True, "fp_id": fp_id, "score": score})

        else:
            self._json_response(404, {"error": "not found"})


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    global _ser_ref
    ser      = open_serial(SERIAL_PORT, SERIAL_BAUD)
    _ser_ref = ser

    reader_thread = threading.Thread(target=serial_reader, args=(ser,), daemon=True)
    reader_thread.start()

    server = HTTPServer(("0.0.0.0", HTTP_PORT), BridgeHandler)
    log.info(f"Bridge HTTP server listening on port {HTTP_PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("Bridge shutting down.")
        close_session(ser)
        ser.close()


if __name__ == "__main__":
    main()
