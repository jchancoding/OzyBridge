# FiiO BTR17 protocol notes

Status: layouts written from static reading of two sources. Not yet confirmed on our device.

- "Observed" means seen on our device.
- "FiiO" means read from the public FiiO Control web bundle (`fiiocontrol.fiio.com/static/js/index-7hb30NUo.js`, read 2026-10-26). This is the official app, so it is the primary reference.
- "devicePEQ" means read from [jeromeof/devicePEQ](https://github.com/jeromeof/devicePEQ) `devicePEQ/fiioUsbHidHandler.js` at `0617f38`.

## USB identity (observed, macOS, 2026-10-26)

| Field | Value |
|---|---|
| Vendor ID | `0x2972` (10610), GuangZhou FIIO Electronics |
| Product ID | `0x0088` |
| bcdDevice | `0x0128` |
| Product name | `FIIO BTR17` |
| Serial | not provided (cannot key per-unit storage on serial) |
| Speed | USB 2.0 high speed |

Interfaces:

| # | Class | Purpose |
|---|---|---|
| 0 | Audio control | USB Audio |
| 1 | Audio streaming | USB Audio |
| 2 | 0xFE / 0x01 | DFU (firmware update). Never touch. |
| 3 | HID | "FIIO BTR17 (MQA HID)" |
| 4 | HID | Control + consumer keys |

Command channel (observed descriptor): vendor collection with **report ID 7**, 32-byte input and 32-byte output. Report ID 2 is consumer control (volume/play keys). A separate vendor page `0xFF00` collection exposes a 64-byte feature report (purpose unknown, likely MQA; leave alone).

## Transport (FiiO)

- WebHID only for this model. No adapter class: the BTR17 uses FiiO Control's default ("legacy") HID path, shared by most FiiO/JadeAudio/SnowSky dongles.
- Report ID 7. Output reports zero-padded to 32 bytes.
- Request/response: send one frame, wait for the next input report. FiiO matches replies on byte 4 (command ID) only.
- All device I/O goes through one serial task queue. Never have two requests in flight.
- Band writes are fire-and-forget (`sendReport`, no wait). FiiO waits for a reply on everything else, but our BTR17 does not reply to sets (see Bench results), so OzyBridge sends all sets blind and verifies with gets.
- One controller at a time: close FiiO Control before connecting OzyBridge.

## Frame layout (FiiO)

```
byte  0     header 1      0xAA = set, 0xBB = get
byte  1     header 2      0x0A = set, 0x0B = get
bytes 2-3   sequence      uint16 big-endian, increments per frame, wraps 0xFFFF -> 0
byte  4     command ID
byte  5     payload length N
bytes 6..   payload       N bytes
byte  6+N   checksum      CRC-8/MAXIM (poly 0x31 reflected, init 0x00, no xorout) over bytes 0..5+N
byte  7+N   0xEE          end marker
```

Replies use the get headers (`0xBB 0x0B`), echo the command ID in byte 4, length in byte 5, payload from byte 6.

devicePEQ difference: it sends `0x00 0x00` for the sequence and `0x00` in the checksum slot, and reportedly works. That suggests the firmware ignores both, but we follow FiiO's framing exactly so our bytes match the official app's.

### Worked examples (sequence 0)

| Frame | Bytes |
|---|---|
| Get current preset | `BB 0B 00 00 16 00 C9 EE` |
| Get band count | `BB 0B 00 00 18 00 15 EE` |
| Get band 0 | `BB 0B 00 00 15 01 00 76 EE` |
| Get preamp | `BB 0B 00 00 17 00 0D EE` |
| Get firmware version | `BB 0B 00 00 0B 00 AC EE` |
| Set band 0 = LSC 22 Hz +6.6 dB Q 0.73 | `AA 0A 00 00 15 08 00 00 42 00 16 00 49 01 80 EE` |
| Set preamp -6.9 dB | `AA 0A 00 00 17 02 FF BB 7F EE` |
| Switch to USER1 | `AA 0A 00 00 16 01 A0 CC EE` |
| Save to USER1 | `AA 0A 00 00 19 01 A0 93 EE` |

These are unit-test vectors for the frame encoder.

## Value encoding (FiiO, matches devicePEQ)

| Value | Encoding |
|---|---|
| Gain (band and preamp) | int16 big-endian, dB x 10, two's complement. -6.9 dB = `FF BB` |
| Frequency | uint16 big-endian, Hz, integer |
| Q | uint16 big-endian, Q x 100. Q 0.73 = `00 49` |
| Filter type | `0` peak, `1` low shelf, `2` high shelf |
| Preset ID | 1 byte (minimal-width integer) |

## MVP commands

| ID | Name (FiiO enum) | Get payload | Get reply payload | Set payload | Notes |
|---|---|---|---|---|---|
| `0x0B` | FIRMWARE_VERSION | none | version bytes (length in byte 5) | n/a | read-only |
| `0x15` | PEQ_PARAMS | `[band]` | `[band, gainHi, gainLo, freqHi, freqLo, qHi, qLo, type]` | same 8 bytes | band 0-9 |
| `0x16` | PEQ_PRE | none | `[presetId]` | `[presetId]` | switch active preset |
| `0x17` | GLOBAL_GAIN | none | `[gainHi, gainLo]` | `[gainHi, gainLo]` | preamp |
| `0x18` | PEQ_COUNT | none | `[count]` | not used by FiiO | read only in MVP |
| `0x19` | PEQ_SAVE | n/a | ack | `[presetId]` | commit edited bands to the slot |

### Write sequence (FiiO, editing a user slot)

1. Switch to the target slot (`0x16`), wait for reply.
2. Write preamp (`0x17`), then wait about 2 s (devicePEQ and FiiO's serial path do).
3. Write each band (`0x15`), about 100 ms apart, no reply wait.
4. Save (`0x19 [slotId]`) right after the last band. FiiO's capture (2026-10-26) saved 18 ms after band 9, with no preamp set in the sequence, and no `0x16` switch.
5. OzyBridge addition: read every band and the preamp back and compare.

Unused bands: write gain 0 (FiiO resets bands to the defaults below rather than shrinking the count).

FiiO's "reset slot" for the BTR17 writes these 10 bands (peak, gain 0, Q 1) and preamp 0: 32, 64, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz.

## Forbidden commands

| ID | FiiO name | Why |
|---|---|---|
| `0x21` | RESET_TO_FACTORY | FiiO sends `AA 0A .. 21 01 00 ..` for factory reset. **devicePEQ uses `0x21 [slotId]` as "save V2" for the BTR17.** We do not use `0x21` at all. Save is `0x19`. |
| `0x1B` | RESET_PRE | resets current preset |
| `0x1C` | RESET_ALL_PRE | resets all presets |
| `0x30` | PEQ_NAME | not supported on BTR17 (see below) |
| any | DFU interface | never |

## EQ model

| Item | Value | Source |
|---|---|---|
| Bands per slot | 10 | FiiO, devicePEQ |
| Filter types | peak, low shelf, high shelf | FiiO |
| Gain range | -24 to +12 dB (FiiO default; BTR17 has no override). devicePEQ constrains to ±12. | FiiO |
| Q range | 0.25 to 8 | FiiO default |
| Q handling | FiiO sends Q unchanged. devicePEQ pre-compensates Q from REW measurements. OzyBridge sends unchanged by default so presets read back identically in FiiO Control. | both |

Slot IDs (FiiO and devicePEQ agree):

- Built-in: 0 Jazz, 1 Pop, 2 Rock, 3 Dance, 4 R&B, 5 Classic, 6 Hip-hop
- User: 160 to 169 (USER1 to USER10). Writable.
- 240: EQ off. The BTR17 has no separate EQ on/off command; FiiO treats EQ as always on and uses preset 240 for off.

## Preset names: not on the device

FiiO Control only allows custom preset names (`0x30`) for a fixed list of products. The BTR17 is not on it. Slot names live in OzyBridge's browser storage.

## Other settings

The FiiO Control web app shows only EQ, firmware update and factory reset for the BTR17. Its audio-config page is only for gaming models, and nothing in the web app calls filter mode, channel balance or max volume. The BTR17's other settings (gain mode, digital filter, Bluetooth options) are presumably in the mobile app over Bluetooth.

Commands present in FiiO's shared table that might apply, all unverified on the BTR17 and out of MVP:

| ID | FiiO name |
|---|---|
| `0x01` | VOL_MAX |
| `0x02` | VOL_OUTPUT |
| `0x04` | FILTER_MODE (sharp, slow, short-delay sharp, short-delay slow, NOS) |
| `0x06` | LED_LIGHT |
| `0x07` | VOL_BALANCE (`[left, right]`, one side 0). devicePEQ calls this "global gain L/R". |
| `0x08` | VOL_OUTPUT_SWITCH |

If added later: read-only probe first, then set on the bench.

## Bench results (observed, 2026-10-26, OzyBridge bench)

- Gets `0x18`, `0x16`, `0x15`, `0x17` reply within about 30 ms. Layouts match the doc. Our frames with a real sequence and CRC are accepted.
- Every reply has sequence `00 00` and CRC byte `00`. The device does not fill either field.
- No reply arrives to get `0x0B` (firmware) or to set `0x16` (switch preset) within 1 s, at least none with `BB 0B` headers. The adapter now sends sets blind and verifies with a get.
- USER1 on our unit held bands at 31 and 62 Hz, not FiiO's 32 and 64 Hz reset defaults. The slot was probably edited before.
- Round 2 (blind sets, raw input logging): set `0x16` takes effect, confirmed by a get 200 ms later. Band and preamp sets take effect, and read-back matched exactly for a one-band change, the 10-band A2000 file, and the restore. A full slot write takes about 4.5 s with the 2 s preamp wait.
- Sets get no reply of any kind. About 16 ms after each `BB 0B` reply the device sends one all-zero report 7. It is a trailer, not an ack. `parseReply` ignores it.
- Get `0x0B` gets nothing but that trailer. The BTR17 config sets `firmwareCmd: false`.
- Chrome exposes the command collection as usage page `0x01`, usage `0x00` (in and out report 7), plus consumer control `0x0C/0x01` (in report 2) on the same HID device. The chooser filters on usage page `0x01`, and it then lists a single BTR17 entry (confirmed).

- Round 3 (power cycle): after writing A2000 to USER10 and saving with `0x19 [A9]`, then unplugging, USER10 kept the **new preamp (-6.9 dB) but the old bands**. `0x19` alone does not persist band edits on the BTR17. Band edits do take effect live until power is lost.

- Round 4 (EQ off, 2026-10-27, read-only probe): with EQ switched off in the device's own settings, get `0x18` and get `0x16` still reply, and `0x16` reports slot 0 (Jazz), not 240. Get `0x15` (band read) gets only the all-zero trailer and no `BB 0B` reply, so the read times out. With EQ on and Jazz selected, all band reads and the preamp read reply normally, so built-in slots are readable. The adapter maps a timeout on band 0 to `EqDisabledError`.

- Round 5 (node-hid harness `scripts/`, 2026-10-27): after a `0x16` switch, the `0x16` get and the preamp read update at once, but band reads keep returning the previous slot's bands until about 500 to 600 ms after the switch (stale at 500 ms, correct at 600 ms, 8 of 8 trials each). This holds for user-to-user and built-in-to-user switches alike. A read that starts early can come back half old, half new. The adapter waits `slotSettleMs` (600 ms) on top of `setGapMs` (200 ms) before reading or writing a slot. Verified: `readSlot` over all ten user slots matches long-wait reference reads, starting from Jazz and from USER1.

## FiiO Control behaviour (bundle `index-7hb30NUo.js`, re-read 2026-10-27)

- The BTR17 has no model-specific adapter. It uses FiiO's generic HID path.
- Connect order: get `0x1A` (FiiO enum `PEQ_SWITCH`, EQ on/off), get `0x18`, get `0x16`, then bands `0x15` 0 to 9 and get `0x17`. Only the active preset is read. FiiO never switches presets to read other slots.
- `0x1A` reply byte 0 is read as `0 = off, anything else = on`. Set `0x1A [0|1]` (`AA 0A .. 1A 01 xx`) is FiiO's EQ on/off. The bundle does not use preset 240 anywhere. The 240 "EQ off" slot comes from devicePEQ and is unverified.
- On a failed connect read, FiiO shows "invalid data, check that EQ is open", matching the EQ-off timeouts in round 4.
- FiiO listens for unsolicited `0x16` reports (preset changed on the device) and re-reads bands and preamp when one arrives.
- For the BTR15 adapter, FiiO's preset switch sends `0x16` and then waits 1000 ms, consistent with the settle delay in round 5.
- Our 2026-10-26 capture shows get `0x1A` replying `00` while band reads worked, so the reply meaning on the BTR17 is unconfirmed.
- `0x1A` is not in OzyBridge's allowed set. Next step, if wanted: add get `0x1A` only, read it with EQ on and off on the device, then decide.

## Open questions

1. (Answered in round 2.) Sets take effect, and nothing comes back for them.
2. (Answered 2026-10-26.) FiiO persists with the same `0x19 [slot]`; bands then save, no preamp in between. Power-cycle verified on USER1. Rounds 3 and 4 above ran with FiiO Control open and are unreliable. Old question: how does FiiO Control persist BTR17 band edits? Capture it (see ROADMAP Phase 4 next step). Do not try `0x21` blind: FiiO uses it for factory reset, even though devicePEQ uses `0x21 [slotId]` as the BTR17 save.
3. Is there a heartbeat on HID, and what frame? (Short capture.)
4. Does the BLE link accept the same commands? (Later.)

## Other models

Data comes from devicePEQ hardware captures. All are untested with OzyBridge.

| Model | Product ID | Gain/preamp dB | User slots | EQ-off slot |
| --- | --- | --- | --- | --- |
| FiiO KA15 | 0x0104 | -12..12 | 7, 8, 9 | 10 |
| SNOWSKY Melody | 0x0126 | -12..12 | 160, 161, 162 | 240 |
| FiiO KA17 (report ID 1) | 0x0093 | -12..12 | 4, 8, 9 | 10 |
| FiiO QX13 | 0x0128 | -24..12 | 160-169 | 240 |

KA17 and QX13 realise a peaking band's Q as `Q_sent / A`, `A = 10^(|gain dB| / 40)` (devicePEQ measurements). OzyBridge sends `Q * A` and divides on read; `capabilities.q` is the wire range. Shelves need no correction: the device uses the Q-form RBJ shelf, as AutoEQ does. devicePEQ's shelf correction converts from a slope convention and must not be ported.

Both captures report 10 bands and decode with our framing. Some models echo sets as `AA 0A` frames; these are not replies and are ignored.

FiiO Oak Nano (0x4016) is held back: its capture reports 8 bands, a flat slot reads preamp +12 dB, and FiiO wrote 7 for a -5 dB preamp. That suggests a +12 dB preamp offset we do not model. Needs a probe from an owner.
