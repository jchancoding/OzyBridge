# Cayin RU3

Status: probe only. No EQ adapter, no commands sent by OzyBridge.

| Field | Value |
|---|---|
| Vendor ID | `0x2D87` (Cayin) |
| Product ID | `0x003B` (Windows driver hardware ID, unconfirmed on our hardware) |

PEQ arrived in RU3 firmware v1.0.3 (Cayin, 2026-08-25), set through Cayin's app. No public capture or protocol source exists as of 2026-10-29: devicePEQ has no Cayin handler.

## Next

1. Owner `?verify` probe with Cayin's app closed: confirm the product ID and record every HID collection (usage page, report IDs, feature reports).
2. If a vendor collection exists, capture Cayin's app setting one band (PK 1000 Hz +3 dB Q 1) to learn the read and write frames. Only then add an adapter, read-only first.
