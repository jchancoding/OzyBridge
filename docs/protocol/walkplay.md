# WalkPlay USB HID protocol notes

Status: read-only slice for Scheme 10 (MOONDROP Marigold). Derived from hardware captures and [jeromeof/devicePEQ](https://github.com/jeromeof/devicePEQ) `devicePEQ/walkplayHidHandler.js` (0BSD). Not yet confirmed on our device.

## USB identity (capture, 2026-05-03)

| Field | Value |
|---|---|
| Vendor ID | `0x35D8` (13784) |
| Product ID | `0x011C` (284) |
| Product name | `MOONDROP Marigold` |
| Scheme | 10 (8 bands, PK only) |

## Transport

- WebHID, **report ID `0x4B` (75)**. Output reports are zero-padded to the descriptor length.
- Request/response: one `sendReport` per command; wait for the next matching input report on byte 1 (command).
- Direction byte at index 0: **`0x80` = read**, **`0x01` = write**.
- Packet terminator where present: `0x00` (`END`).

## Commands used in this slice (read only)

| Command | Hex | Read request bytes (after report ID) |
|---|---|---|
| Firmware version | `0x0C` | `80 0C 00` |
| PEQ coefficients | `0x09` | `80 09 00` (slot query) or `80 09 00 00 <band> 00` (per band) |
| Global gain | `0x03` | `80 03 00` |

Firmware reply: `80 0C 00` followed by ASCII version bytes starting at index 3 (e.g. `0.1`).

Global gain reply: signed int8 at byte 4 when bytes 2–3 are `02 00`.

PEQ per-band reply layout (report ID stripped):

| Offset | Field |
|---|---|
| [1] | `0x09` |
| [4] | Band index (0-based) |
| [7..26] | Five int32 LE biquad coefficients |
| [27..28] | Frequency, uint16 LE, Hz |
| [29..30] | Q, uint16 LE, 8.8 fixed-point |
| [31..32] | Gain, int16 LE, 8.8 fixed-point, dB |
| [33] | Type: `1=LS 2=PK 3=HS 4=LP 5=HP` |

Scheme 10 has no frequency or Q compensation on read; values above are used directly.

## Forbidden until a later verified slice

Do not send write direction (`0x01`), including PEQ writes (`0x09`), global gain write (`0x03`), flash (`0x01`), memory refresh (`0x05`), ENC refresh (`0x17`), or temp write (`0x0A`). Mic gain, DAC extras, and other command bytes are out of scope.

## Marigold capture reference

Read session bytes match `src/devices/walkplay/__fixtures__/walkplay_default_moondrop_marigold.json` (from devicePEQ `tests/captures/walkplay_default_moondrop_marigold.json`).
