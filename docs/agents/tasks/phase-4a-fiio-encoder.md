# Task: FiiO frame encoder and decoder (Phase 4a, pulled forward)

Read `AGENTS.md` first.

Task: pure TypeScript encoder/decoder for FiiO HID frames and EQ values, tested against the protocol doc's byte vectors.
Phase: 4 (pulled forward to run alongside Phase 3; no device I/O).

## Files you may create or change

- `src/devices/fiio/protocol.ts`
- `src/devices/fiio/protocol.test.ts`

## Files to read for context (nothing else)

- `AGENTS.md`
- `docs/protocol/fiio-btr17.md` (frame layout, worked examples, value encoding, MVP and forbidden commands)
- `src/core/eq.ts` (the `EqBand` type)

## Requirements

1. `crc8Maxim(bytes: Uint8Array): number`: CRC-8/MAXIM, reflected poly 0x31 (`0x8C` shift-right form), init 0, no xorout.
2. `export const CMD = { FIRMWARE_VERSION: 0x0B, PEQ_PARAMS: 0x15, PEQ_PRE: 0x16, GLOBAL_GAIN: 0x17, PEQ_COUNT: 0x18, PEQ_SAVE: 0x19 } as const`.
3. `buildFrame(kind: 'get' | 'set', cmd: number, payload: Uint8Array, seq: number): Uint8Array`, laid out as in the doc (headers, uint16 BE seq, cmd, length, payload, CRC over bytes 0..5+N, `0xEE`). Output is the unpadded frame. Padding is the transport's job.
   - Allowlist: get is allowed for `0x0B 0x15 0x16 0x17 0x18`; set is allowed for `0x15 0x16 0x17 0x19`. Anything else, including `0x21`, `0x1B`, `0x1C` and `0x30`, throws `ForbiddenCommandError`. Export the allowlist as a `ReadonlyMap` or as sets.
   - `seq` must be an integer from 0 to 0xFFFF, and every payload byte must be 0 to 255, otherwise throw `RangeError`.
4. `createSequence(start = 0): () => number` returns 0, 1, ... and wraps 0xFFFF to 0.
5. Value codecs, all big-endian. Each throws `RangeError` if the value doesn't fit its integer width after rounding:
   - `encodeGain(db)`: int16 of `Math.round(db * 10)`. `decodeGain(hi, lo)`.
   - `encodeFreq(hz)`: uint16 of `Math.round(hz)`. `decodeFreq`.
   - `encodeQ(q)`: uint16 of `Math.round(q * 100)`. `decodeQ`.
   - Filter type mapping: `PK` = 0, `LSC` = 1, `HSC` = 2. Decoding an unknown type throws.
6. `encodeBandPayload(index: number, band: EqBand): Uint8Array` returns the 8 bytes `[index, gainHi, gainLo, freqHi, freqLo, qHi, qLo, type]`. A disabled band is written with gain 0. `decodeBandPayload(p): { index: number; band: EqBand }` with `enabled: true`.
7. Message builders, each taking `seq` last: `getFirmware`, `getBandCount`, `getActivePreset`, `getPreamp`, `getBand(index)`, `setBand(index, band)`, `setActivePreset(id)`, `setPreamp(db)`, `savePreset(id)`.
8. `parseReply(bytes: Uint8Array): { cmd: number; payload: Uint8Array; seq: number; crcOk: boolean } | null`. Returns null unless byte 0 is `0xBB`, byte 1 is `0x0B`, the length fits inside the buffer and the byte after the CRC is `0xEE`. Trailing zero padding is allowed. A CRC mismatch does not reject the reply; it sets `crcOk: false`, because it is still unknown whether the device fills in the CRC.
9. Tests:
   - Every worked example in the doc, built through the message builders, must equal the doc bytes exactly. Set band 0 is LSC 22 Hz, gain 6.6, Q 0.73. The other examples are in the doc table.
   - Round-trip `parseReply` on a get frame turned into a reply.
   - `crcOk` false on a corrupted CRC. Null on a bad header, missing end marker, or length overrun.
   - Forbidden commands throw, including `buildFrame('set', 0x21, ...)` and a get of `0x19`.
   - Range errors for gain, Q, frequency and seq. Negative gain round-trip (-6.9 dB is `FF BB`).
   - Sequence wraps from 0xFFFF to 0.

## Out of scope

- Any device I/O, WebHID or transport use, adapter class, DeviceAdapter implementation, or model config.
- Clamping to the device's EQ limits. That is Phase 3 constraint fitting, in `src/core/`.
- Editing the protocol doc or the roadmap.

## Done when

- `npm test` and `npm run typecheck` pass.
- No files outside the list above were created or changed.

Reply with: files changed, test results (counts), open issues. No explanations.
