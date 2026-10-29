# Cayin RU3

Status: probe only. No EQ adapter, no commands sent by OzyBridge. Offered in the `?verify` chooser only.

| Field | Value |
|---|---|
| Vendor ID | `0x2D87` (Cayin) |
| Product ID | `0x003B` (confirmed by owner probe 2026-10-29) |
| USB product name | `Cayin RU3 (U2)` |

PEQ arrived in RU3 firmware v1.0.3 (Cayin, 2026-08-25), set through Cayin's app. No public capture or protocol source exists as of 2026-10-29: devicePEQ has no Cayin handler.

## HID descriptor (owner `?verify` probe, 2026-10-29, macOS, Chrome 156)

One collection: usage page `0x0C`, usage `0x01`. Input reports 1, 75 (`0x4B`), 3. Output reports 1, 75 (`0x4B`). No feature reports.

Report `0x4B` is the report ID used by the WalkPlay and KTMicro command channels. That suggests (does not prove) the RU3 uses one of those chips. Report 1 and 3 are likely consumer keys and status.

## Next

1. Capture Cayin's app setting one band (PK 1000 Hz +3 dB Q 1) on report `0x4B` to learn the frame format.
2. If the frames match WalkPlay or KTMicro, add the RU3 as a config entry on that family, `untested`, read-only first.
