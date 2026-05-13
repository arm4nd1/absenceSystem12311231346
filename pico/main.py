"""
Pico W2 – Fingerprint Attendance Node
======================================
Hardware wiring
  R307 VCC  → 3.3 V
  R307 GND  → GND
  R307 TX   → GP1  (Pico UART0 RX)
  R307 RX   → GP0  (Pico UART0 TX)

  Bridge TX → GP4  (Pico UART1 RX)  ← PC Python bridge
  Bridge RX → GP5  (Pico UART1 TX)  → PC Python bridge

  Green LED → GP16 (active HIGH via 220 Ω)
  Red   LED → GP17 (active HIGH via 220 Ω)
  Session   → GP15 (pulled HIGH by bridge to open session)

Protocol (JSON lines over UART1 @ 115200):
  Pico → PC   {"type":"scan","fp_id":3,"score":95,"ts":1234567}
  Pico → PC   {"type":"enroll_ok","fp_id":5,"ts":1234567}
  Pico → PC   {"type":"enroll_fail","reason":"timeout","ts":1234567}
  Pico → PC   {"type":"no_match","ts":1234567}
  Pico → PC   {"type":"error","reason":"...","ts":1234567}
  PC   → Pico {"cmd":"enroll","fp_id":5}
  PC   → Pico {"cmd":"delete","fp_id":5}
  PC   → Pico {"cmd":"count"}
  PC   → Pico {"cmd":"clear"}
"""

import ujson
import utime
from machine import Pin, UART

import config
from r307 import R307, OK, ERR_NO_FINGER, ERR_TIMEOUT, ERR_NOSEARCH

# ── Peripherals ───────────────────────────────────────────────────────────────
led_green   = Pin(config.LED_GREEN,   Pin.OUT, value=0)
led_red     = Pin(config.LED_RED,     Pin.OUT, value=0)
session_pin = Pin(config.SESSION_PIN, Pin.IN,  Pin.PULL_DOWN)

bridge = UART(config.BRIDGE_UART_ID,
              baudrate=config.BRIDGE_UART_BAUD,
              tx=Pin(config.BRIDGE_UART_TX),
              rx=Pin(config.BRIDGE_UART_RX),
              bits=8, parity=None, stop=1,
              timeout=100)

sensor = R307(uart_id=config.UART_ID,
              tx=config.UART_TX,
              rx=config.UART_RX,
              baud=config.UART_BAUD,
              address=config.FP_ADDRESS,
              password=config.FP_PASSWORD)

# ── Helpers ───────────────────────────────────────────────────────────────────

def send(obj: dict):
    bridge.write(ujson.dumps(obj) + "\n")

def blink(led, times=2, ms=150):
    for _ in range(times):
        led.value(1)
        utime.sleep_ms(ms)
        led.value(0)
        utime.sleep_ms(ms)

def ts():
    return utime.time()

def readline_nonblock() -> str | None:
    """Read a complete JSON line from bridge UART without blocking."""
    if bridge.any():
        raw = bridge.readline()
        if raw:
            return raw.decode("utf-8", "ignore").strip()
    return None

# ── Startup ───────────────────────────────────────────────────────────────────

def startup():
    blink(led_green, 3, 100)
    code = sensor.verify_password()
    if code != 0:
        blink(led_red, 5, 100)
        send({"type": "error", "reason": f"sensor_init_fail:{code:#04x}", "ts": ts()})
    else:
        send({"type": "ready", "ts": ts()})

# ── Command dispatcher ────────────────────────────────────────────────────────

def handle_command(line: str):
    try:
        cmd = ujson.loads(line)
    except Exception:
        return

    action = cmd.get("cmd", "")

    if action == "enroll":
        fp_id = int(cmd.get("fp_id", 0))
        blink(led_green, 1, 300)
        code = sensor.enroll(fp_id, led_green, led_red)
        if code == OK:
            send({"type": "enroll_ok", "fp_id": fp_id, "ts": ts()})
        else:
            reason = "timeout" if code == ERR_TIMEOUT else f"code:{code:#04x}"
            send({"type": "enroll_fail", "fp_id": fp_id, "reason": reason, "ts": ts()})

    elif action == "delete":
        fp_id = int(cmd.get("fp_id", 0))
        code  = sensor.delete_model(fp_id)
        send({"type": "delete_ok" if code == OK else "delete_fail",
              "fp_id": fp_id, "ts": ts()})

    elif action == "count":
        code, n = sensor.get_template_count()
        send({"type": "count", "count": n, "ts": ts()})

    elif action == "clear":
        code = sensor.empty_library()
        send({"type": "clear_ok" if code == OK else "clear_fail", "ts": ts()})

# ── Main loop ─────────────────────────────────────────────────────────────────

def run():
    startup()
    in_session = False

    while True:
        # check for incoming command from bridge
        line = readline_nonblock()
        if line:
            handle_command(line)

        # session pin controls whether we actively scan
        active = session_pin.value() == 1
        if active and not in_session:
            in_session = True
            send({"type": "session_open", "ts": ts()})
        elif not active and in_session:
            in_session = False
            send({"type": "session_close", "ts": ts()})
            led_green.value(0)
            led_red.value(0)

        if in_session:
            status, fp_id, score = sensor.identify(timeout_s=1)

            if status == OK and score >= config.MATCH_THRESHOLD:
                blink(led_green, 2, 120)
                send({"type": "scan", "fp_id": fp_id,
                      "score": score, "ts": ts()})
                # debounce – don't re-scan same finger for 3 s
                utime.sleep_ms(3000)

            elif status == ERR_NOSEARCH:
                blink(led_red, 3, 80)
                send({"type": "no_match", "ts": ts()})
                utime.sleep_ms(2000)

            # ERR_TIMEOUT / ERR_NO_FINGER → just continue polling

        utime.sleep_ms(20)

run()
