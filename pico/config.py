# ─── Pico W2 Configuration ───────────────────────────────────────────────────
# Copy this file and edit values for your environment.

# WiFi Credentials (used if sending directly via HTTP)
WIFI_SSID     = "YOUR_WIFI_SSID"
WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"

# Serial / UART settings for R307 fingerprint sensor
# TX → GP0, RX → GP1  (UART0)
UART_ID   = 0
UART_TX   = 0   # GPIO pin number
UART_RX   = 1   # GPIO pin number
UART_BAUD = 57600

# R307 password (default 0x00000000)
FP_PASSWORD = 0x00000000
FP_ADDRESS  = 0xFFFFFFFF  # broadcast address

# Bridge serial port (the PC-side serial that Pico talks to)
# Pico sends JSON lines over this UART to the Python bridge
BRIDGE_UART_ID   = 1
BRIDGE_UART_TX   = 4   # GPIO pin number
BRIDGE_UART_RX   = 5   # GPIO pin number
BRIDGE_UART_BAUD = 115200

# Session control pin – pulled HIGH by PC to open an attendance session
SESSION_PIN = 15

# LED indicator pins
LED_GREEN = 16
LED_RED   = 17

# Timeout (seconds) to wait for a valid fingerprint scan
SCAN_TIMEOUT = 10

# Confidence threshold for fingerprint match (0–100)
MATCH_THRESHOLD = 50
