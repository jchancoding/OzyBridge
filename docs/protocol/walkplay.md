# WalkPlay USB HID protocol notes

Status: read-only slice for schemes 10, 15, 16, and 18. Derived from hardware captures and [jeromeof/devicePEQ](https://github.com/jeromeof/devicePEQ) `devicePEQ/walkplayHidHandler.js` (0BSD). Not yet confirmed on our hardware.

## USB identity (captures, 2026-05-03)

| Model | Vendor ID | Product ID | Scheme |
|---|---|---|---|
| MOONDROP Marigold | `0x35D8` | `0x011C` | 10 |
| ddHiFi DSP Cable - Memory | `0x3302` | `0x4357` | 15 |
| TANCHJIM-STARGATE II | `0x3302` | `0x43D4` | 15 (PK only) |
| Protocol Max | `0x3302` | `0x43CC` | 16 |
| TP35 Pro | `0x3302` | `0x43E6` | 16 |
| TANCHJIM-SPACE PRO | `0x3302` | `0x4367` | 16 (PK only) |
| Octave | `0x3302` | `0x39C3` | 18 |

## Schemes (read path in OzyBridge)

| Scheme | Bands | Filter types (UI) | Gain range | Models |
|---|---|---|---|---|
| 10 | 8 | PK | ±10 dB | Marigold |
| 15 | 8 | LSC, PK, HSC (Stargate II: PK only) | ±10 dB | ddHiFi DSP Cable, TANCHJIM-STARGATE II |
| 16 | 10 | LSC, PK, HSC (Space Pro: PK only) | ±10 dB | Protocol Max, TP35 Pro, TANCHJIM-SPACE PRO |
| 18 | 10 | LSC, PK, HSC | ±10 dB | Octave |

Custom user slot id **101** (`Custom`) on all models above. No frequency or Q compensation on read for these schemes.

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
| [33] | Type byte (see below) |

### Type byte (index 33)

Decoded on read as:

| Byte | Filter |
|---|---|
| `1` | Low shelf (LSC) |
| `2` | Peaking (PK) |
| `3` | High shelf (HSC) |
| `4` | LP (unsupported in OzyBridge read path — **ProtocolError**) |
| `5` | HP (unsupported in OzyBridge read path — **ProtocolError**) |

Values are used directly; schemes 10, 15, 16, and 18 apply **no** frequency or Q compensation on read.

## Forbidden until a later verified slice

Do not send write direction (`0x01`), including PEQ writes (`0x09`), global gain write (`0x03`), flash (`0x01`), memory refresh (`0x05`), ENC refresh (`0x17`), or temp write (`0x0A`). Mic gain, DAC extras, and other command bytes are out of scope.

## Capture references

Fixtures under `src/devices/walkplay/__fixtures__/` are copied from devicePEQ `tests/captures/` (0BSD).
