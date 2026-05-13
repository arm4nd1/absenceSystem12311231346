"""
R307 / AS608 fingerprint sensor driver for MicroPython (Pico W2).

Packet structure:
  Start Code  : 0xEF01                (2 bytes)
  Address     : 4 bytes               (default 0xFFFFFFFF)
  Packet ID   : 1 byte                (0x01 = command, 0x02 = data, 0x07 = end, 0x08 = ack)
  Packet Len  : 2 bytes               (length of data + checksum)
  Data        : variable
  Checksum    : 2 bytes               (sum of Packet ID + Packet Len + Data bytes)
"""

import utime
from machine import UART, Pin

# ── Packet identifiers ────────────────────────────────────────────────────────
PKTID_CMD  = 0x01
PKTID_DATA = 0x02
PKTID_ACK  = 0x07
PKTID_END  = 0x08

# ── Confirmation codes returned in ACK packets ────────────────────────────────
OK              = 0x00
ERR_RECV        = 0x01
ERR_NO_FINGER   = 0x02
ERR_ENROLL_FAIL = 0x03
ERR_DISORDERED  = 0x06
ERR_LACKPOINTFP = 0x07
ERR_NOTMATCH    = 0x08
ERR_NOSEARCH    = 0x09
ERR_BADLOCATION = 0x0B
ERR_DELETEFAIL  = 0x10
ERR_DBRANGEFAIL = 0x11
ERR_UPLOADFAIL  = 0x13
ERR_PACKETRESPFAIL = 0x14
ERR_UPLOADFEATFAIL = 0x15
ERR_DELETEFINGERFAIL = 0x16
ERR_FLASHERR    = 0x18
ERR_INVALIDREG  = 0x1A
ERR_ADDRCODE    = 0x20
ERR_PASSVERIFY  = 0x21
ERR_TIMEOUT     = 0xFF  # local synthetic error

# ── Commands ──────────────────────────────────────────────────────────────────
CMD_GENIMG      = 0x01
CMD_IMG2TZ      = 0x02
CMD_MATCH       = 0x03
CMD_SEARCH      = 0x04
CMD_REGMODEL    = 0x05
CMD_STORE       = 0x06
CMD_LOADCHAR    = 0x07
CMD_UPCHAR      = 0x08
CMD_DOWNCHAR    = 0x09
CMD_UPIMAGE     = 0x0A
CMD_DOWNIMAGE   = 0x0B
CMD_DELETECHAR  = 0x0C
CMD_EMPTY       = 0x0D
CMD_WRITERREG   = 0x0E
CMD_READRREG    = 0x0F
CMD_TEMPLATENUM = 0x1D
CMD_VERIFYPSW   = 0x13
CMD_GETRANDOM   = 0x14
CMD_HISPEEDSEARCH = 0x1B


class R307:
    def __init__(self, uart_id: int, tx: int, rx: int,
                 baud: int = 57600,
                 address: int = 0xFFFFFFFF,
                 password: int = 0x00000000):
        self._uart = UART(uart_id, baudrate=baud,
                          tx=Pin(tx), rx=Pin(rx),
                          bits=8, parity=None, stop=1,
                          timeout=2000)
        self._addr = address
        self._pwd  = password

    # ── Low-level packet I/O ─────────────────────────────────────────────────

    def _write_packet(self, pkt_id: int, data: bytes) -> None:
        length = len(data) + 2          # +2 for 2-byte checksum
        header = bytes([
            0xEF, 0x01,
            (self._addr >> 24) & 0xFF,
            (self._addr >> 16) & 0xFF,
            (self._addr >>  8) & 0xFF,
             self._addr        & 0xFF,
            pkt_id,
            (length >> 8) & 0xFF,
             length       & 0xFF,
        ])
        chk = pkt_id + (length >> 8) + (length & 0xFF) + sum(data)
        packet = header + data + bytes([(chk >> 8) & 0xFF, chk & 0xFF])
        self._uart.write(packet)

    def _read_packet(self, timeout_ms: int = 3000) -> tuple:
        """Returns (pkt_id, data_bytes) or raises RuntimeError on timeout."""
        deadline = utime.ticks_add(utime.ticks_ms(), timeout_ms)
        buf = bytearray()

        while utime.ticks_diff(deadline, utime.ticks_ms()) > 0:
            chunk = self._uart.read(256)
            if chunk:
                buf.extend(chunk)
            # look for start code
            while len(buf) >= 2:
                idx = -1
                for i in range(len(buf) - 1):
                    if buf[i] == 0xEF and buf[i+1] == 0x01:
                        idx = i
                        break
                if idx == -1:
                    buf = buf[-1:]
                    continue
                if idx > 0:
                    buf = buf[idx:]
                # need at least 9 bytes for header + minimal data + checksum
                if len(buf) < 9:
                    break
                pkt_len = (buf[7] << 8) | buf[8]
                total   = 9 + pkt_len
                if len(buf) < total:
                    break
                pkt_id  = buf[6]
                payload = bytes(buf[9: 9 + pkt_len - 2])
                buf     = buf[total:]
                return pkt_id, payload

        raise RuntimeError("R307 timeout waiting for response")

    def _command(self, data: bytes, timeout_ms: int = 3000) -> tuple:
        self._write_packet(PKTID_CMD, data)
        return self._read_packet(timeout_ms)

    # ── High-level API ────────────────────────────────────────────────────────

    def verify_password(self) -> int:
        pwd = self._pwd
        data = bytes([CMD_VERIFYPSW,
                      (pwd >> 24) & 0xFF, (pwd >> 16) & 0xFF,
                      (pwd >>  8) & 0xFF,  pwd        & 0xFF])
        _, resp = self._command(data)
        return resp[0] if resp else ERR_RECV

    def get_template_count(self) -> tuple:
        """Returns (status, count)."""
        _, resp = self._command(bytes([CMD_TEMPLATENUM]))
        if not resp:
            return ERR_RECV, 0
        count = (resp[1] << 8) | resp[2] if len(resp) >= 3 else 0
        return resp[0], count

    def gen_image(self) -> int:
        """Capture fingerprint into image buffer. Returns confirmation code."""
        _, resp = self._command(bytes([CMD_GENIMG]))
        return resp[0] if resp else ERR_RECV

    def image_to_tz(self, slot: int) -> int:
        """Convert image buffer → character file in slot 1 or 2."""
        _, resp = self._command(bytes([CMD_IMG2TZ, slot]))
        return resp[0] if resp else ERR_RECV

    def create_model(self) -> int:
        """Combine char buffers 1 & 2 into template."""
        _, resp = self._command(bytes([CMD_REGMODEL]))
        return resp[0] if resp else ERR_RECV

    def store_model(self, slot: int, page_id: int) -> int:
        """Store template from slot into flash at page_id."""
        _, resp = self._command(bytes([CMD_STORE, slot,
                                        (page_id >> 8) & 0xFF,
                                         page_id       & 0xFF]))
        return resp[0] if resp else ERR_RECV

    def search(self, slot: int = 1,
               start: int = 0, count: int = 0x00FF) -> tuple:
        """Search library for char file in slot.
        Returns (status, page_id, match_score)."""
        data = bytes([CMD_SEARCH, slot,
                      (start >> 8) & 0xFF,  start & 0xFF,
                      (count >> 8) & 0xFF,  count & 0xFF])
        _, resp = self._command(data)
        if not resp or len(resp) < 5:
            return resp[0] if resp else ERR_RECV, 0, 0
        page_id = (resp[1] << 8) | resp[2]
        score   = (resp[3] << 8) | resp[4]
        return resp[0], page_id, score

    def delete_model(self, page_id: int, count: int = 1) -> int:
        data = bytes([CMD_DELETECHAR,
                      (page_id >> 8) & 0xFF, page_id & 0xFF,
                      (count   >> 8) & 0xFF, count   & 0xFF])
        _, resp = self._command(data)
        return resp[0] if resp else ERR_RECV

    def empty_library(self) -> int:
        _, resp = self._command(bytes([CMD_EMPTY]))
        return resp[0] if resp else ERR_RECV

    # ── Enrollment helper ────────────────────────────────────────────────────

    def enroll(self, page_id: int, led_green=None, led_red=None) -> int:
        """
        Full two-scan enrollment workflow.
        Returns OK on success, error code otherwise.
        """
        def _indicate(success):
            if success:
                if led_green: led_green.value(1)
                if led_red:   led_red.value(0)
            else:
                if led_green: led_green.value(0)
                if led_red:   led_red.value(1)
            utime.sleep_ms(600)
            if led_green: led_green.value(0)
            if led_red:   led_red.value(0)

        for scan_num in (1, 2):
            # wait for finger
            deadline = utime.ticks_add(utime.ticks_ms(), 10_000)
            while utime.ticks_diff(deadline, utime.ticks_ms()) > 0:
                code = self.gen_image()
                if code == OK:
                    break
                if code != ERR_NO_FINGER:
                    _indicate(False)
                    return code
                utime.sleep_ms(50)
            else:
                return ERR_TIMEOUT

            code = self.image_to_tz(scan_num)
            if code != OK:
                _indicate(False)
                return code
            _indicate(True)

            if scan_num == 1:
                # wait for finger to be removed
                utime.sleep_ms(500)
                while self.gen_image() != ERR_NO_FINGER:
                    utime.sleep_ms(100)

        code = self.create_model()
        if code != OK:
            _indicate(False)
            return code

        code = self.store_model(1, page_id)
        if code == OK:
            _indicate(True)
        else:
            _indicate(False)
        return code

    # ── Identification helper ────────────────────────────────────────────────

    def identify(self, timeout_s: int = 10) -> tuple:
        """
        Wait up to *timeout_s* seconds for a valid fingerprint.
        Returns (status, page_id, score).
        """
        deadline = utime.ticks_add(utime.ticks_ms(), timeout_s * 1000)
        while utime.ticks_diff(deadline, utime.ticks_ms()) > 0:
            code = self.gen_image()
            if code == OK:
                code = self.image_to_tz(1)
                if code == OK:
                    return self.search(1)
            elif code != ERR_NO_FINGER:
                return code, 0, 0
            utime.sleep_ms(50)
        return ERR_TIMEOUT, 0, 0
