# OzyBridge roadmap

## Goal

A login-free static web app that replaces vendors' clunky EQ apps for USB DACs and dongles:

- Import and export Squiglink / AutoEQ parametric EQ text on any supported device. This is the core job. FiiO `.xml` stays as a FiiO-only extra.
- OzyBridge is a transfer tool, not an EQ designer. Users build EQs in Squiglink, PeqDB Studio or AutoEQ and bring them here.
- Manage device slots with real names visible at a glance. Only show what the connected device supports.
- Adding a model on a known protocol is a config entry. Adding a vendor is one adapter behind `DeviceAdapter`.

## UX principles

- Clean, easy to navigate, seamless.
- Fewest clicks possible. Common jobs in one or two clicks: connect, pick slot, drop an EQ file, done.
- Import is drag-and-drop or paste onto a slot; it writes, verifies and shows the result without extra confirm steps.

## MVP: Phases 0-6 (closed 2026-10-27)

FiiO BTR17 over WebHID, live at https://jchancoding.github.io/OzyBridge/ via `.github/workflows/pages.yml`. 116 tests. Task specs for each phase are in `docs/agents/tasks/` (historical). Facts later phases depend on:

- Protocol: `docs/protocol/fiio-btr17.md`. Report ID 7, 32-byte frames, uint16 sequence, CRC-8/MAXIM. `src/devices/fiio/protocol.ts` allowlists commands.
- Safety: save is `0x19 [slot]`. `0x21` is FiiO's factory reset (devicePEQ misuses it as a save) and is forbidden.
- Write order: preamp, then all bands, then `0x19`. Sets get no reply; every write is verified by gets. About 4.5 s per slot.
- Persistence: leave the written slot active. Switching back before unplug lost USER10's bands.
- Import never alters a file to make it fit. Too many bands, out-of-range values or unsupported filter types are rejected with plain reasons. Fitting only rounds, pads and lowers the preamp when the curve passes 0 dB.
- Slot names are browser-side, keyed by a preamp+band fingerprint (`src/core/slotNames.ts`). The BTR17 stores no names.
- No auto-reconnect: the BTR17 has no USB serial, so Chrome drops the permission on unplug.
- FiiO Control's public bundle (also copied in devicePEQ's `fiio-js-capture/`) is the source for per-model slots, limits and pacing. Read it with narrow searches only.

Loose ends carried forward: FiiO Control conflict message untested on hardware; unused `.toggle` CSS in `src/App.css`.

## Phase 7: Multi-device

Easy wins first, by cost. Analysis 2026-10-27, from devicePEQ `usbDeviceConfig.js` and FiiO Control's bundle.

| Target | Fit | Notes |
|---|---|---|
| FiiO BTR13 | Config entry plus two small model fields | 10 bands, ±12 dB, USER1-3 = slots 7-9, EQ off = 11, report ID 7, save `0x19`, same pacing group as the BTR17. FiiO forces filter type to peak when reading BTR13 bands, so treat it as PK-only. FiiO picks models by product name, not product ID; the BTR13's product ID is unknown. |
| FiiO KA15, KA17, JA11, K15, K19, others on the legacy HID path | Config entries | Same framing. Each differs in slot IDs, EQ-off ID, gain range. K17/K19 have 31 bands. |
| Walkplay chip (many Moondrop and Tanchjim dongles, plus Truthear, ddHifi, LETSHUOER, CrinEar, NiceHCK) | New adapter, biggest reach | One "Custom" slot, mostly 8 bands (some 10), ±10 dB, often PK-only. Several "scheme" variants with frequency and Q compensation. devicePEQ has captures and tests per scheme. |
| KT Micro chip (Tanchjim Bunny, Fission, One; Kiwi Ears; JCally) | New adapter, smaller | 5 bands, ±12 dB, one slot, no pregain. Captures exist. |
| Moondrop native HID, Conexant (FreeDSP, Echo B) | Later | Per-model quirks. |

Steps:

1. Model matching by product name (and product ID when known), so models whose product ID is unknown can still be recognised. Per-model filter types, EQ-off ID and slot table already live in `FiiOModel.capabilities`.
2. BTR13 as an "untested" model: read-only on connect until a tester confirms. Remote testing: the tester opens the deployed `?bench` page, runs one read-only script and pastes the result lines. Then one single-slot write with read-back, then a power cycle.
3. One-slot devices need a browser-side preset library (store many EQs, push one to the device). This is also the cross-device feature: one library, any device.
4. Walkplay adapter ported from devicePEQ, read-only first. Needs a tester with a device.

Exit: BTR13 verified by a tester, a preset library in use, and one non-FiiO adapter verified on hardware.

## Phase 8: Visual refresh

Brainstorm first, then a written spec, then build. Within `docs/design/STYLEGUIDE.md` (WipeOut / Ridge Racer), with a PSP-era nostalgic layer:

- Pixel-art mascot or logo, drawn as code (rect-based SVG, 16-24 px grid, 4-6 colours) so it stays crisp and small. Idle animation in CSS only.
- Glass panels (backdrop blur over a subtle animated grid or scanline background), with `prefers-reduced-motion` and contrast fallbacks.
- Small hover moments: slot cards that tilt or glint, a "boot" stagger on connect, a scan sweep across the graph after a write.
- Optional "skins" (palette swaps via tokens), which also fit the monetisation ideas below.

Workflow tips gathered from r/ClaudeAI: give the model a reference screenshot and the token file, change one design dimension at a time (type, colour, motion), and for the mascot use a code-first pixel workflow (e.g. claude-pxl, sprite-forge) rather than image generation.

## Backlog (not scheduled)

- Repo: protect `main` (PRs required, no force-push); work on branches and merge with PR notes.
- Footer: discreet "buy me a coffee" PayPal link; credits for Inter, JetBrains Mono and Michroma (SIL OFL).
- Squiglink integration: open the current EQ in Squiglink, or overlay a headphone's measured response (read-only, user-initiated, no runtime network by default).
- Shareable EQ links (EQ encoded in the URL fragment, no server).
- A/B compare two slots, undo last write, export all slots as one zip or JSON.
- Monetisation stays non-intrusive: donations first; optional cosmetic skins or mascot variants later. No ads or tracking, which would break the "no network, no analytics" rule.

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

- OzyBridge may use at most 10% of the total Cursor budget, and less is better. Keep a buffer.
- One planner chat per phase with few turns. Hand off to a fresh chat when a chat gets long (large logs, many rounds).
- Batch device tests: one bench script per question set, run once. The user pastes only the result lines asked for, not full frame logs.
- Default to Sonnet low or Composer for planning and execution. Use Opus only for protocol decoding that cheaper models have failed at.
- No speculative extras. Do only what the phase's exit criteria need.
