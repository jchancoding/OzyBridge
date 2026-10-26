# Task: FiiO HID adapter and BTR17 model config (Phase 4b)

Read `AGENTS.md` first.

Task: implement `DeviceAdapter` for FiiO's HID protocol on top of `HidTransport` and `protocol.ts`, with the BTR17 as a config entry, tested against a simulated device.
Phase: 4. No real device in this task. The planner runs the bench check afterwards.

## Files you may create or change

- `src/devices/types.ts`
- `src/devices/fiio/models.ts` (new)
- `src/devices/fiio/adapter.ts` (new)
- `src/devices/fiio/adapter.test.ts` (new)
- `src/devices/fiio/fakeFiioHid.ts` (new, test helper only)

## Files to read for context (nothing else)

- `AGENTS.md`
- `docs/protocol/fiio-btr17.md` (transport, write sequence, slot IDs, forbidden commands)
- `src/devices/types.ts`, `src/devices/fiio/protocol.ts`, `src/transport/webhid.ts`, `src/transport/webhid.test.ts` (its `FakeHid` shows how to fake `HidLike`)
- `src/core/eq.ts` (`EqLimits`, `EqProfile`, `profilesEqual`)

## Requirements

1. `types.ts`: `DeviceCapabilities` becomes `EqLimits & { slots: EqSlot[]; eqOffSlotId: number | null }` so `fitProfile` can take it directly. Add `readSlot(id: number): Promise<EqProfile>` to `DeviceAdapter`. It switches to the slot, reads it, then switches back to the slot that was active before, including when the read fails.
2. `models.ts`: `FiioModel { productId; name; reportId; capabilities: DeviceCapabilities }`, `FIIO_VENDOR_ID = 0x2972`, `FIIO_MODELS` with one entry, and `findFiioModel(vendorId, productId)`. BTR17: product ID `0x0088`, report ID 7, 10 bands, PK/LSC/HSC, gain and preamp -24 to +12, Q 0.25 to 8, freq 20 to 20000, step gain 0.1 / Q 0.01 / freq 1, defaultFreqs 32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000. Slots: 0 Jazz, 1 Pop, 2 Rock, 3 Dance, 4 R&B, 5 Classic, 6 Hip-hop (not writable), 160 to 169 labelled USER1 to USER10 (writable). `eqOffSlotId` is 240.
3. `adapter.ts`: `connectFiio(device: HidLike, opts?: { timing?: Partial<FiioTiming>; hid?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>; log?: (dir: 'out' | 'in', bytes: Uint8Array) => void }): Promise<DeviceAdapter>`.
   - Unknown vendor or product ID: throw `UnsupportedDeviceError` before opening.
   - On connect: open a `HidTransport` (the model's report ID, timeout 1000 ms). Read the band count (`0x18`); if it differs from `maxBands`, close and throw `ProtocolError`. Read firmware (`0x0B`): printable ASCII payload becomes a string, otherwise the bytes joined by `.`. A firmware timeout gives `firmware: null` and does not fail the connection.
   - Every get and every set except band writes uses `transport.request` and matches on `parseReply(r)?.cmd === cmd`. A band read reply must echo the requested index, otherwise `ProtocolError`. Replies with `crcOk: false` are accepted. Count them in a public `crcMismatches` number.
   - `log` is called with every outgoing frame and every reply that `parseReply` accepts.
   - Public methods run one at a time through an adapter-level lock, so a `readSlot` can't interleave with a `writeSlot`.
4. Methods:
   - `getActiveSlot`: get `0x16`, return payload byte 0.
   - `setActiveSlot(id)`: the id must be a configured slot or `eqOffSlotId`, otherwise `RangeError`. Set, then read the active slot back. A mismatch throws `ProtocolError`.
   - `readActiveProfile`: get each band 0 to maxBands-1, then the preamp. Return `{ preamp, bands }`.
   - `writeSlot(id, profile)`: guard first and throw `RangeError` without sending anything if the slot isn't writable, the band count isn't exactly `maxBands`, or any type or value (bands and preamp) is outside the capabilities. Then follow the doc's write sequence: switch to the slot (reply, then read the active slot back), send each band with `transport.send` and wait `bandGapMs` between them, set the preamp (reply) and wait `afterPreampMs`, save `0x19 [id]` (reply), then `readActiveProfile`. If `profilesEqual(readBack, profile)` is false, throw `WriteVerifyError` carrying `expected` and `readBack`. Otherwise resolve with `readBack`.
   - `FiioTiming` defaults are `bandGapMs: 100` and `afterPreampMs: 2000`. Export them as `DEFAULT_FIIO_TIMING`.
   - `onDisconnect(cb)`: if `opts.hid` is given (default `navigator.hid` when it exists), listen for `disconnect` events whose `device` is this device. Close the transport and call the callbacks once. A call to `disconnect()` closes the transport, removes the listener and does not call the callbacks.
5. `fakeFiioHid.ts`: a `HidLike` that decodes outgoing frames with `parseReply`-style parsing (`AA 0A` set, `BB 0B` get) and replies like the doc says. Replies use the `BB 0B` headers, echo the cmd, carry a valid CRC and are padded to 32 bytes, delivered asynchronously. It keeps per-slot state: bands and preamp per slot id, the active slot, and saved slot ids. Band and preamp sets apply to the active slot. It records every sent frame. Knobs: `bandCount`, `silentCmds` (no reply), `corruptBandWrites` (stores gain + 1 dB), `firmware` bytes.
6. Tests (`adapter.test.ts`, timing set to 0 in all but one test):
   - Connect reads the band count and firmware. A wrong band count rejects. A firmware timeout still connects. An unknown product ID throws without opening.
   - `writeSlot(165, profile)` sends exactly this frame order: set `0x16`, get `0x16`, ten `0x15` sets, set `0x17`, set `0x19`, ten `0x15` gets, one `0x17` get. The fake's slot 165 then matches, and slot 165 is saved.
   - A padded disabled band (gain 0) verifies as equal.
   - `corruptBandWrites` makes `writeSlot` reject with `WriteVerifyError` that carries both profiles.
   - Guard failures (slot 0, slot 240, 9 bands, gain 13, Q 9, preamp -25, type not allowed) throw `RangeError` and send no frames.
   - `readSlot(161)` with 160 active returns slot 161's profile and leaves 160 active. The same holds when a band read times out (the method rejects, and 160 is active again).
   - `setActiveSlot(240)` works. `setActiveSlot(170)` throws `RangeError`.
   - Across the whole test file, no frame with cmd `0x21`, `0x1B`, `0x1C` or `0x30` is ever sent. Assert this in an `afterEach` on every fake.
   - A `disconnect` event for this device fires the callbacks once. An event for another device does nothing. `disconnect()` doesn't fire them.
   - A reply with a bad CRC is accepted and increments `crcMismatches`.
   - One test uses fake timers and the default timing. Band writes are at least 100 ms apart, and the save comes at least 2000 ms after the preamp reply.

## Out of scope

- UI, `App.tsx`, browser storage, slot names, profile matching.
- Fitting or rounding profiles (the caller fits with `fitProfile` before `writeSlot`).
- Any command not already in `protocol.ts`. Do not edit `protocol.ts` or `webhid.ts`. If they need changing, stop and say why.
- Editing docs or the roadmap.

## Done when

- `npm test` and `npm run typecheck` pass.
- No files outside the list above were created or changed.

Reply with: files changed, test results (counts), open issues. No explanations.
