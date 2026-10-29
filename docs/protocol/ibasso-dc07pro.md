# iBasso DC07 Pro

Status: not supported. No PEQ, so it is out of OzyBridge's scope and not offered in any chooser.

| Field | Value |
|---|---|
| Vendor ID | `0x2FC6` (iBasso) |
| Product ID | `0xF0B7` |
| bcdDevice | `0x0201` |
| Serial | Present (Chrome may keep permission across replug) |

## HID descriptor (owner `?verify` probe, 2026-10-29, macOS, Chrome 156)

One collection: usage page `0x0C`, usage `0x01`, report ID 0, 8-byte input and 8-byte output, no feature reports. macOS also claims it as a consumer-control (volume key) device.

## Command set

From [mzggr0914/Dc07ProUAC](https://github.com/mzggr0914/Dc07ProUAC) (MIT), a clean-room desktop controller. 8-byte payloads on report 0, byte 2 is the bitwise NOT of byte 1, at least 12 ms between writes.

| Purpose | Bytes |
|---|---|
| Query volume (reply starts `0x42`) | `42 11 EE 00 00 00 00 00` |
| Query DAC filter and HP filter (reply `0x59`) | `59 21 DE 00 00 00 00 00` |
| Query S/PDIF, balance, gain (reply `0x60`) | `60 31 CE 00 00 00 00 00` |
| Set volume | `01 10 EF 00 vol vol 00 00` |
| Set filters | `11 20 DF 00 dac hp 00 00` |
| Set S/PDIF, balance, gain (0-2) | `19 30 CF 00 spdif bal gain 00` |

**No parametric EQ.** The device firmware and iBasso's own app expose volume, DAC reconstruction filter, headphone filter, S/PDIF mode, balance and gain only. There is nothing for `DeviceAdapter` (slots, bands) to read or write.

## Not done

- None of these commands are on OzyBridge's allowlist. A device-settings panel (gain, filter, balance) would need a non-EQ capability in `src/devices/types.ts`, which is outside Phase 7. Read-only queries come first if it is ever added.
