# OzyControl roadmap

## Goal

A static web app that fully controls a FiiO BTR17 with no login and no FiiO account:

- Import and export AutoEQ / Squiglink parametric EQ text directly. No FiiO format conversion.
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

### Phase 3: Core EQ (executor model, test-first)

- AutoEQ / Squiglink text parser and exporter (`Preamp:` line, `PK`, `LSC`, `HSC`), round-trip tests.
- FiiO EQ file importer for migrating existing presets.
- Biquad response math for the graph.
- Constraint fitting to device limits (band count, gain, Q, frequency, filter types) with warnings and auto preamp.

### Phase 4: BTR17 adapter (executor model, planner reviews)

Read slot list and bands, write slot with read-back verification, switch slot, bypass, preamp. Then the MVP non-PEQ controls.

### Phase 5: UI (executor model, style guide is the spec)

Connect screen, slot grid (10 named slots), EQ editor with graph, import/export, device settings panel.
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
