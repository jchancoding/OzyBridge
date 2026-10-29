# KTMicro USB HID protocol notes

Status: read-only slice for the `0x31B2:0x0111` chip profile (USB product name varies, for example Kiwi Ears-Allegro Mini). Derived from [jeromeof/devicePEQ](https://github.com/jeromeof/devicePEQ) captures (0BSD) and register facts from [gxcreator/ktmicro-tools](https://github.com/gxcreator/ktmicro-tools) `KT_USB_PROTOCOL.md` (MIT). Not yet confirmed on our hardware.

**Chu II DSP (`0x31B2:0x0113`)** is held back until an owner `?verify` probe confirms the product ID (devicePEQ capture says `0x0113`; other sources disagree).

## USB identity (captures, 2026-05-03)

| Profile | Vendor ID | Product ID | Notes |
|---|---|---|---|
| KTMicro DSP (shared profile) | `0x31B2` | `0x0111` | Allegro Mini, KT02H20 HIFI Audio, etc. (name from USB string) |
| Chu II DSP | `0x31B2` | `0x0113` | Not listed in OzyBridge until probe gate passes |

Not KTMicro in OzyBridge: JadeAudio JA11 (`0x2972:0x0102`) uses FiiO framing in devicePEQ. LS-TC2 (`0x2972:0x0107`) is wanted on the roadmap with no capture.

## Capabilities (0x0111 profile in OzyBridge)

| Bands | Filter types | Gain | Slots | Preamp |
|---|---|---|---|---|
| 5 | LSC, PK, HSC | ±12 dB | One Custom (id 101 in UI) | none |

**Half-frequency quirk:** some older KTMicro devices store half the displayed frequency on the wire (`compensate2X` in devicePEQ). Captures for the `0x0111` profile use `compensate2X=false`; OzyBridge defaults `halfFreq` to false until hardware confirms otherwise.

## Transport

- WebHID, **report ID `0x4B` (75)**. Output reports are zero-padded to the descriptor length.
- Request/response: one `sendReport` per command; match input on register byte 0 and op byte 4.

## Frame layout (11 bytes after report ID)

| Index | Field |
|---|---|
| 0..3 | Register address, uint32 LE (only byte 0 used in captures) |
| 4 | Operation: **`0x52` read**, **`0x57` write**, **`0x53` commit**, **`0x43` CLEAR/handshake |
| 5 | Reserved (`0x00`) |
| 6..9 | Read request: usually zero; read **`0x24`** sends `0x03` in byte 6 (devicePEQ). Write request: value uint32 LE. Read response: value uint32 LE. |

## Registers used in this slice (read only)

| Register | Meaning (read path) |
|---|---|
| `0x24` | DAC EQ enable / current slot. devicePEQ **`getCurrentSlot`** uses response **byte 6** as the slot id. ktmicro-tools documents this address as the DAC EQ enable register (bit0 of the value). |
| `0x26`..`0x2F` | Five PEQ bands, two registers each (gain+freq, then Q+type). Band *N* base = `0x26 + 2N` unless a model provides a `bandRegisters` map (not used for `0x0111`). |
| `0x66` | Digital DAC gain. ktmicro-tools: **DIG_DAC** in byte 0 of the value (signed half-dB steps). devicePEQ **`readPregain`** uses response byte 6 as a signed integer dB; not mapped to UI preamp on the `0x0111` profile. |

### Band encoding (devicePEQ pull)

**Gain/freq register (A):** bytes 6..7 = signed gain ×10 (8.8-style int16 LE); bytes 8..9 = frequency Hz (uint16 LE). Apply `halfFreq` if configured.

**Q/type register (B):** bytes 6..7 = Q ×1000 (uint16 LE); byte 8 = filter type:

| Byte 8 | Filter (OzyBridge) |
|---|---|
| `0` | PK |
| `3` | LSC (devicePEQ `LSQ`) |
| `4` | HSC (devicePEQ `HSQ`) |

## Allowlist (this build)

Outbound frames must be **`0x52` reads** of:

- `0x24` (tail byte 6 = `0x03` only)
- `0x26`..`0x2F`
- `0x66`

The adapter rejects anything else before it reaches the transport.

## Forbidden until a later verified slice

| Item | Hex | Reason |
|---|---|---|
| Write op | `0x57` | Band/global writes |
| Commit | `0x53` | Save to device |
| CLEAR / handshake | `0x43` | Connect handshake, not used read-only |
| Write EQ enable | `0x24` + `0x57` | Slot enable |
| Write digital gain | `0x66` + `0x57` | Pregain / DIG_DAC write |

## Capture references

Fixtures under `src/devices/ktmicro/__fixtures__/` are copied from devicePEQ `tests/captures/` (0BSD). They share this frame format even when the USB product ID is not the listed `0x0111` model.
