# Moondrop USB PEQ protocol

Status: **read from the vendor bundle only. Nothing here has been sent to hardware by OzyBridge yet.**
Source: MOONDROP Sound-Tuning Tool, `https://hub.moondroplab.tech/` bundle `index-BiX0aPAV.js`, read 2026-10-27.
Facts only. No vendor code is copied into this repo.

OzyBridge already reads the Marigold through `src/devices/walkplay/` (same report ID). This doc is the spec for writes and for the other Moondrop models.

## Models in the bundle

All use the same device class and report ID `0x4B` (75), with 8 PEQ bands.

| Name | `peqIndex` | Pre-gain | Config group |
|---|---|---|---|
| Marigold | 7 | yes | marigold |
| DAWN PRO2 | 7 | yes | freeDSPPro |
| FreeDSP Pro | 7 | **no** | freeDSPPro |
| FreeDSP Mini | 7 | yes | freeDSPPro |
| MOONRIVER 3 | 7 | yes | freeDSPPro |
| DHA15 | 7 | yes | freeDSPPro |
| E.S. combo | **4** | yes | freeDSPPro |
| Deco Audio System | 7 | yes | freeDSPPro |
| INN Deco75-DH Audio | 7 | yes | freeDSPPro |
| Rays | 7 | **no** | rays |
| AG Rays | 7 | yes | rays |
| POSITION | 7 | yes | POSITION |

Also present with other device classes (not analysed): Old Fashioned (5 bands, no pre-gain), CM1.

Marigold disables low shelf and high shelf, so it is peaking only (plus the pass filters below, if enabled).

`peqIndex` is written as the last byte of every band write. Its meaning (slot count or target slot) is unconfirmed.

Each config also has an `upgradeDeviceConfig` with VID 1638 / PID 2184. That is the firmware-update device, not the audio device. Never use it.

## Frame

Output report `0x4B`. Bytes:

| Offset | Field |
|---|---|
| 0 | op: `0x80` read, `0x01` write |
| 1 | command |
| 2 | payload length |
| 3.. | payload |

Reads expect a reply. Writes are sent without waiting for one.

## Commands

| ID | Name (Moondrop enum) | Use |
|---|---|---|
| `0x0C` | FIRMWARE_VERSION | read |
| `0x0F` | EQ_ACTIVE | read / write active preset index (1 byte) |
| `0x09` | EQ_UPDATE | read one band / write one band |
| `0x0A` | EQ_COEFF | "enable all PEQ" write |
| `0x23` | PRE_GAIN | read / write, int16 LE, dB × 256 |
| `0x01` | EQ_SAVE_FLASH | write, persist EQ |
| `0x04` | OFFSET_SAVE_FLASH | write, persist offsets |
| `0x02` / `0x03` | ADC_OFFSET / DAC_OFFSET | not EQ, out of scope |
| `0x24` | DEVICE_VOLUME | not EQ, out of scope |

Forbidden for OzyBridge:

| ID | Name | Why |
|---|---|---|
| `0x05` | FLASH_CLEAR (target `0x04` = all) | erases flash |
| `0xFF` | UPGRADE_ENTER | enters firmware update |
| any | firmware-update device (VID 1638 / PID 2184) | never |

## Band read (`0x80 0x09`)

Payload: `[0x00, bandIndex]`. Reply fields from offset 27:

| Offset | Field |
|---|---|
| 27 | frequency, uint16 LE, Hz |
| 29 | Q, int16 LE, × 256 |
| 31 | gain, int16 LE, dB × 256 |
| 33 | filter type (table below) |

Moondrop waits 50 ms between band reads.

## Band write (`0x01 0x09`, payload length 33)

| Payload offset | Field |
|---|---|
| 0 | `0x00` |
| 1 | band index |
| 2, 3 | `0x00 0x00` |
| 4..23 | biquad coefficients, 5 × int32 LE (below) |
| 24 | frequency, uint16 LE |
| 26 | Q, int16 LE, × 256 |
| 28 | gain, int16 LE, dB × 256 |
| 30 | filter type |
| 32 | `peqIndex` from the model config |

The device does not compute its own filters. The host sends coefficients:

- RBJ cookbook biquads at a **96 kHz** sample rate, normalised by a0.
- Order `[b0, b1, b2, -a1, -a2]`. Note the sign flip on the a terms.
- Each scaled by 2^30 and rounded to int32.
- A disabled band sends 20 zero bytes.

Filter types: `0` disabled, `1` low shelf, `2` peaking, `3` high shelf, `4` low pass, `5` high pass.

## Write sequence (Moondrop)

1. Write each band, about 25 ms apart.
2. Write pre-gain if the model supports it.
3. `EQ_SAVE_FLASH`, then wait 200 ms.

Other timings: 50 ms between operations, 150 ms after an `EQ_ACTIVE` change.

## Before OzyBridge writes to a Moondrop device

1. Generate coefficients in `src/core/` and test them against known values (Vitest).
2. Read-only: compare our band decode with the Marigold capture fixture already in `src/devices/walkplay/__fixtures__/`.
3. Single band write on one device, read back, then a power cycle.
4. Confirm what `peqIndex` means before writing it.
