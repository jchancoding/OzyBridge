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

## Family probe (read-only)

Cayin's PEQ app is Android-only, so the app's writes cannot be captured from a desktop. Instead, `?verify` sends the existing read frames from `docs/protocol/walkplay.md` and `docs/protocol/ktmicro.md` to any unlisted device with output report `0x4B` (`src/devices/familyProbe.ts`), and records the replies:

| Read | Frame |
|---|---|
| WalkPlay firmware | `80 0C 00` |
| WalkPlay band 1 | `80 09 00 00 00 00` |
| KTMicro EQ state | `24 00 00 00 52 00 03 00 00 00` |
| KTMicro band 1 gain/freq, Q/type | `26 00 00 00 52 ...`, `27 00 00 00 52 ...` |

No write, commit or clear frames are sent.

## Next

1. In Cayin Control (Android), set band 1 to PK 1000 Hz +3 dB Q 1, others flat. Close the app, plug into the computer, run `?verify`.
2. If one family's band 1 line decodes to that band, add the RU3 as a config entry on that family, `untested`, read-only first. If neither replies, the RU3 uses its own protocol and needs Cayin Control's frames.
