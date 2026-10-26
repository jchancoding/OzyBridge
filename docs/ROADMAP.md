# OzyControl roadmap

## Goal

A static web app that fully controls a FiiO BTR17 with no login and no FiiO account:

- Import and export Squiglink / AutoEQ parametric EQ text directly, and FiiO's own EQ file (`.xml`) for moving presets to and from FiiO Control.
- OzyControl is a transfer tool, not an EQ designer. Users build EQs in Squiglink, PeqDB Studio or AutoEQ and bring them here.
- Manage the 10 user EQ slots with real names visible at a glance.
- Expose the device's other settings that FiiO Control exposes.
- Be built so other FiiO models, and later other vendors, are config or adapter additions.

First iteration scope: FiiO BTR17, then FiiO models on the same HID protocol. No other vendors.

## UX principles

- Clean, easy to navigate, seamless.
- Fewest clicks possible. Common jobs in one or two clicks: connect, pick slot, drop an EQ file, done.
- Import is drag-and-drop or paste onto a slot; it writes, verifies and shows the result without extra confirm steps.
- Only show what the connected device supports.

## Key findings (2026-10-26)

- BTR17 has a WebHID command channel (report ID 7, 32-byte in/out). See `docs/protocol/fiio-btr17.md`.
- FiiO Control is itself a WebHID web app supporting about 30 devices with one shared protocol layer. That confirms both feasibility and the expandability path within FiiO.
- [jeromeof/devicePEQ](https://github.com/jeromeof/devicePEQ) (0BSD) already implements BTR17 PEQ read/write, plus handlers for Moondrop, Qudelix, Walkplay, Topping, JDS Labs, KT Micro, Conexant and others. PEQ protocol risk is largely retired. Remaining unknowns are non-PEQ controls and preset names.

## Phases

Each phase ends with a short written result in this file before the next phase starts.

### Phase 0: Feasibility (done)

USB descriptors read, FiiO Control transport identified, prior art found.

### Phase 1: Protocol confirmation (planner model, high effort)

1. Read devicePEQ's FiiO handler and BTR17 config; write exact packet layouts into the protocol doc.
2. Capture FiiO Control traffic with a WebHID logger in Chrome DevTools while the user changes one setting at a time. The user logs in; the agent never handles credentials.
3. List every non-PEQ control and its command. Decide which are in MVP.
4. Test preset-name support read-only.

Exit: protocol doc has a verified layout for every MVP command.

Result (2026-10-26, steps 1, 3, 4 done statically):

- FiiO Control's public bundle contains its full command table, frame builder and per-model feature gates. Exact layouts are in `docs/protocol/fiio-btr17.md`.
- Frames carry a uint16 sequence and a CRC-8/MAXIM checksum. devicePEQ zeroes both. We match FiiO.
- Safety: devicePEQ saves BTR17 EQ with `0x21`, which is FiiO's factory-reset command. FiiO saves with `0x19`. `0x21` is forbidden in OzyControl.
- No device-stored preset names on the BTR17. Names are browser-side.
- FiiO Control's web app exposes only EQ, firmware update and factory reset for the BTR17. MVP is EQ only.
- Step 2 is reduced to one short optional capture to confirm framing and save acknowledgements (`tools/capture/webhid-logger.js`). Otherwise the adapter verifies itself with read-only probes in Phase 4.

### Phase 2: Scaffold (executor model)

Vite + React + TS strict, Vitest, tokens CSS from the style guide, folder layout from `AGENTS.md`, `DeviceAdapter` interface, WebHID transport with request/response matching and pacing.

Result (2026-10-26): done per `docs/agents/tasks/phase-2-scaffold.md`. Executor: Sonnet 5.5 low; planner reviewed. 15 tests, typecheck and build pass. Toolchain: TypeScript 7, Vite 8, Vitest 5, React 19. Fonts deferred to Phase 5 (need approval for self-hosted font files). Transport is tested only against a fake device.

### Phase 3: Core EQ (executor model, test-first)

- AutoEQ / Squiglink text parser and exporter (`Preamp:` line, `PK`, `LSC`, `HSC`), round-trip tests.
- FiiO EQ file importer for migrating existing presets.
- Biquad response math for the graph.
- Constraint fitting to device limits (band count, gain, Q, frequency, filter types) with warnings and auto preamp.

Result (2026-10-26): done per `docs/agents/tasks/phase-3a-formats.md` and `phase-3b-response-and-fit.md`. Executors: Sonnet 5.5 low, run in parallel; planner reviewed. 72 tests, typecheck passes.

- Decisions made with the user. Imports are never altered to make them fit. A file with too many bands, out-of-range values or unsupported filter types is rejected, and every problem is listed in plain language. Fitting only rounds values to device precision (0.1 dB, Q 0.01, 1 Hz), pads unused bands, and sets the preamp.
- Preamp: the file's value is kept unless the fitted curve would go above 0 dB. Then it is lowered and a note says so. It is never raised.
- FiiO EQ files are FiiO's XML (`<FiiO_DSP>`). Import only; no FiiO XML exporter yet.
- Fixtures: the A2000 AutoEQ file fits with its own -6.9 dB preamp (curve peak +4.2 dB). `BA15 REVJET.xml` peaks at +6.05 dB, so its -6 dB preamp is lowered to -6.1.
- BTR17 limits live in tests for now. The real config belongs to the Phase 4 adapter.

### Phase 4: BTR17 adapter (executor model, planner reviews)

Read slot list and bands, write slot with read-back verification, switch slot, bypass, preamp. Then the MVP non-PEQ controls.

Pulled forward (2026-10-26): the pure frame encoder and decoder, `src/devices/fiio/protocol.ts`, per `docs/agents/tasks/phase-4a-fiio-encoder.md`. It matches all nine protocol doc vectors and allowlists commands, so `0x21` and the other forbidden commands throw. Replies with a bad CRC are flagged, not rejected. There is no device I/O yet.

Progress (2026-10-26): 4b adapter and 4c format exports done per `docs/agents/tasks/phase-4b-btr17-adapter.md` and `phase-4c-format-exports.md`. Executors: Sonnet 5.5 low, in parallel; planner reviewed. 103 tests, typecheck and build pass.

- `connectFiio` checks the band count on connect and refuses on a mismatch. Writes check limits before sending anything, follow FiiO's sequence, save with `0x19`, then read back and reject on a mismatch. `readSlot` restores the previously active slot. EQ off is `setActiveSlot(240)`. The BTR17 is a config entry in `src/devices/fiio/models.ts`.
- Squiglink's export format is the same as AutoEQ's (checked in squig.link's `graphtool.js`). Two-channel Squiglink files (`Channel: L/R`) are rejected with a plain message. `exportAutoEq` can omit flat bands. `exportFiioXml` reproduces FiiO's file layout byte for byte.
- 4d bench (`?bench`, `src/ui/Bench.tsx`) on the real BTR17: reads, slot switches, band and preamp writes all verified. Sets get no reply, so they are sent blind and verified by gets. The chooser shows one entry. Write time about 4.5 s is accepted by the user. Details in the protocol doc's "Bench results".
- **Blocker:** band edits are lost on power cycle. The preamp persists. `0x19` is not enough for bands.

Next step (fresh chat, Sonnet low or Composer, short):

1. The user captures FiiO Control saving one band change on USER10 with `tools/capture/webhid-logger.js` and saves the dump as `captures/btr17-save.json`.
2. The agent reads only the `out` frames from that file (for example `rg '"out"'`), finds the save sequence, and adds the command to `protocol.ts` (with a test vector) and to the write sequence in `adapter.ts`.
3. The user reruns the bench power-cycle check once: Clear log, Connect, 1, 2, 4, unplug and replug, reload, Connect, 1, 5. In step 5, "USER10 before restore" must show A2000 (Filter 1 `LSC Fc 22 Hz Gain 6.6 dB`). Paste only the step 5 block.
4. Write the Phase 4 result here and close the phase.

### Phase 5: UI (executor model, style guide is the spec)

Connect screen, slot grid (10 named slots), EQ view with graph, import/export, device settings panel.

- Import/export: one button pair per format. "Squiglink / AutoEQ (.txt)" and "FiiO (.xml)". Squiglink and AutoEQ share one text format, so they share a button. Text export omits flat bands (Squiglink does the same). FiiO export writes all device bands.
- EQ view is barebones (decided 2026-10-26): response graph plus a band table with plain numeric fields for small tweaks (gain, frequency, Q, type, preamp). No draggable graph handles, no headphone measurements, no target curves, no auto-EQ. Those live in Squiglink and PeqDB Studio.
Slot names live in browser storage keyed by product name, plus JSON backup/restore. If the device turns out to store names, write them to the device too. On connect, match device bands to known profiles so names survive changes made elsewhere.

### Phase 6: Hardening and release

Disconnect/reconnect handling, FiiO Control conflict detection, pacing tuning, static deploy (GitHub Pages or Cloudflare Pages).

### Later

- More FiiO models via config entries (BTR13, BTR15, KA17, K19, etc.).
- Other vendors by porting devicePEQ handlers as adapters.
- Web Bluetooth control for the BTR17 if BLE exposes the same commands.

## Model routing

| Work | Model | Effort |
|---|---|---|
| Planning, protocol decoding, architecture, reviewing diffs | Claude Opus | high for decoding, low for reviews |
| Scoped implementation from a task spec | Composer 2.5 or Claude Sonnet | low |
| Mechanical edits, renames, formatting, doc tidy | Composer 2.5 Fast or Haiku | default |

Rules:

- One planner (Opus) chat per phase acts as orchestrator. It writes task specs from `docs/agents/TASK_TEMPLATE.md` and launches executor subagents on the cheaper model itself. The user does not copy specs between chats.
- Executors get only the spec, `AGENTS.md`, and the files the spec lists. They reply with files changed, test results, open issues.
- The planner reviews the diff and test output, not the whole codebase, then commits.
- At the end of a phase, the planner writes the result into this file and the next phase starts in a fresh chat. Long chats re-send their whole history every turn, so fresh chats per phase keep cost down.
- Do not switch models mid-chat. It discards the prompt cache.

Budget (set by the user, 2026-10-26):

- OzyControl may use at most 10% of the total Cursor budget, and less is better. About 4% was used through Phase 4. Keep a buffer: aim to finish Phases 5 and 6 within about 3% more.
- One planner chat per phase with few turns. Hand off to a fresh chat when a chat gets long (large logs, many rounds).
- Batch device tests: one bench script per question set, run once. The user pastes only the result lines asked for, not full frame logs.
- Default to Sonnet low or Composer for planning and execution. Use Opus only for protocol decoding that cheaper models have failed at.
- No speculative extras. Do only what the phase's exit criteria need.
