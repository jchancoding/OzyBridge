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
- Import never alters a file to make it fit. Too many bands, out-of-range values or unsupported filter types are rejected with plain reasons. Fitting only rounds and pads. It never changes the preamp: when the curve can pass 0 dB it returns a clipping warning with a suggested preamp, and the UI shows it (verified on a BTR17 2026-10-27: a -2 dB preamp with a +5.8 dB band stays at -2 dB). Import all slots restores a backup made by Export all slots.
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

Exit: BTR13 verified by a tester, a preset library in use (done in 7a), and one non-FiiO adapter verified on hardware.

Done early (2026-10-27): `?probe`, a read-only page that reports any FiiO device's product ID, USB collections, band count, active slot, preamp and raw bands, for remote testers.

Phase 7a (closed 2026-10-27, PRs #4-#10, 170 tests). Specs in `docs/agents/tasks/phase-7a-*.md`.

- Quality of life: export all slots as JSON, one-level undo of the last write, shareable EQ links in the URL fragment, compare overlay, preset library in browser storage (`ozy-presets`). This covers step 3.
- devicePEQ easy wins, all flagged `untested` with a landing caveat and a prefilled GitHub issue link ("Report how it went"): FiiO KA15, SNOWSKY Melody (config entries, tests decode devicePEQ's read captures), FiiO KA17 and QX13 (peaking Q correction `Q_wire = Q * 10^(|gain|/40)` in `src/core/qCompensation.ts`). Shelves are not corrected; see `docs/protocol/fiio-btr17.md`.
- Held back for 7b: FiiO Oak Nano (8 bands, apparent +12 dB preamp offset), JadeAudio JA11 (disconnects on save, breaks read-back), and the ~25 FiiO entries without captures or known product IDs (devicePEQ sends `0x21` on K17/K19).
- Not yet exercised in a browser against hardware. Smoke-test undo, share links and preset drop on the BTR17.
- Lesson: executors launched as worktree runners still shared the main checkout and cross-committed. The planner must create each worktree itself and pass its absolute path.

Phase 7b (in progress; read-only Walkplay and `?verify` are on `main`): BTR13 and the held-back models via `?verify`, then one verified write each; promote models out of `untested` as device reports arrive.

Phase 7b plan, single-slot DSP cables (2026-10-29). We reviewed JohnnyGuerra/dac-peq-manager (MIT) for device leads only, not code. Specs in `docs/agents/tasks/phase-7b-0..3-*.md`, in order:

0. `?verify` upgrades: vendor `0x31B2` in the picker, exact-ID registry with no fallback, descriptor-only probe for unknown devices, report schema 2 (bands, raw hex), single-band step, restart-on-save step. No new commands.
1. KTMicro read-only (`0x31B2:0x0111` by product name; Chu II DSP only if the probe shows `0x0113`). Allowed: `0x52` reads of `0x24`, `0x26`-`0x2F`, `0x66`.
2. KTMicro writes: `0x57` bands, `0x53` commit, restart, read-back. Answers whether Chrome keeps the permission after a restart.
3. Moondrop FreeDSP/May: identify by probe first. FreeDSP Pro/Mini (`0x35D8:0x98D3/4`) go ahead; Conexant FreeDSP (`0x35D8:0x1496`) is write-only and blocked; `0x31B2:0x0112` has no source yet.

Hardware on loan: Moondrop May or FreeDSP, Kiwi Ears Allegro Mini, Moondrop Chu II DSP.

Open facts: Chu II ID (devicePEQ capture `0x31B2:0x0113`, dac-peq-manager `0x1112` or `0x0112`); the KTMicro half-frequency quirk; the meaning of Moondrop `peqIndex`.

Wanted (no captures, no owners): CrinEar Protocol Micro (Walkplay scheme 11, `0x3302:0xC20F`), TRUTHEAR KEYX (`0x3302:0x4362`), LS-TC2 (`0x2972:0x0107`). devicePEQ has scheme 11 captures for other models (Quark2, EPZ TP13, Hi Max, CS43131 HiFi Audio DSP), so a scheme 11 read path can come later. JA11 stays on the held-back FiiO list, since devicePEQ captured it with FiiO framing.

Probe-only vendors (2026-10-29): Cayin `0x2D87` is in the `?verify` picker (not the main Connect chooser). The RU3 exposes report `0x4B`, the WalkPlay/KTMicro report ID; needs a capture of Cayin's app (`docs/protocol/cayin-ru3.md`). Not supported: iBasso DC07 Pro, which has no PEQ (`docs/protocol/ibasso-dc07pro.md`).

Porting rule for other vendors: port devicePEQ handlers chip by chip into typed adapters, use its captures as test fixtures, keep our command allowlist and read-back. Do not copy its handlers wholesale (its BTR17 save is FiiO's factory reset).

## Phase 8: Visual refresh

Brainstorm first, then a written spec, then build. Within `docs/design/STYLEGUIDE.md` (WipeOut / Ridge Racer), with a PSP-era nostalgic layer:

- Pixel-art mascot or logo, drawn as code (rect-based SVG, 16-24 px grid, 4-6 colours) so it stays crisp and small. Idle animation in CSS only.
- Glass panels (backdrop blur over a subtle animated grid or scanline background), with `prefers-reduced-motion` and contrast fallbacks.
- Small hover moments: slot cards that tilt or glint, a "boot" stagger on connect, a scan sweep across the graph after a write.
- Dark mode: a dark token set in `src/ui/tokens.css`, following `prefers-color-scheme` with a manual toggle stored in the browser. Graph and drop colours checked for contrast in both.
- Optional "skins" (palette swaps via tokens), which also fit the monetisation ideas below.

Workflow tips gathered from r/ClaudeAI: give the model a reference screenshot and the token file, change one design dimension at a time (type, colour, motion), and for the mascot use a code-first pixel workflow (e.g. claude-pxl, sprite-forge) rather than image generation.

Phase 8 (closed 2026-10-27, PRs #13, #15-#20, 254 tests). Direction "Mirage", spec in `docs/design/phase-8-spec.md`, task specs in `docs/agents/tasks/phase-8*.md`.

- Dark "desert night" theme following the OS, footer THEME toggle (`ozy-theme`), set before paint. Light theme fixed for WCAG AA (accent, text-3, drop, ok, danger, warn, accent-strong, line-strong). Hard-coded colours replaced by semantic tokens. `src/ui/contrast.test.ts` enforces the text, graph-curve, drop and glass pairs for both themes.
- Glass on the sticky chrome only, with solid fallbacks; a faint perspective-grid floor (plus scanlines in dark); footer MOTION toggle (`ozy-motion`) that stops all ambient motion.
- Hover glints, boot stagger on connect, scan sweep after a verified write.
- Ozy, the hooded wanderer: 24x24 rect SVG, 5 colours, 9 frames from one anchor, a 64 s CSS-only walk / sit / tea / gaze loop behind all content.
- Build grew 17.5 kB minified (budget 20 kB). No new dependencies, fonts or network calls. `src/core/`, `src/devices/`, `src/transport/` untouched.
- Skipped: 8e skins. Still open: hover, stagger and sweep not yet seen with a device connected; BTR17 smoke test (connect, write one slot, drop a file) in both themes.
- Lessons: executors cannot judge visuals. The planner had to redraw the sit, tea and gaze frames, move Ozy out of the animated `<main>` (its transform made `<main>` his fixed containing block), and swap solid text backgrounds for a halo (they boxed in the grid). Render frames and screenshot each wave before merging. Vitest returns '' for `?raw` CSS, so tests read files with `node:fs`. Other chats use the main checkout too; the planner verifies merged work in a detached worktree from `origin/main`, not by pulling there.

## Phase 9: OzyEQ and response overlays

OzyBridge is now partly an EQ designer: EQ design goes hand in hand with DAC import and export. Decided 2026-10-28.

- OzyEQ (`?eq`): the slot editor without a device, on every browser including phones and tablets. Limits come from a chosen device model, or "No device" (10 bands, PK/LSC/HSC, ±12 dB, Q 0.1-10). Import Squiglink / AutoEQ `.txt` or FiiO `.xml` by file, paste or drop; export `.txt` download, copied text, or a share link that opens the device flow on desktop. Draft kept in `ozy-eq-draft`.
- Landing without WebHID: no CONNECT DAC, a plain message pointing to Chrome or Edge on a computer, OzyEQ as the next step. Desktop header: CONNECT DAC and OZYEQ left-aligned next to the brand.
- Shared editor: `src/ui/EqEditor.tsx`, `useEqDraft.ts`, `NumField.tsx` serve both the device workspace and OzyEQ.
- Measurement overlay: an IEM from squiglink (live, user-initiated, cached per session) or an uploaded REW / squiglink file, drawn as original and equalized. Base URL rules per `urlType` in `src/core/squiglink.ts`; all databases send `Access-Control-Allow-Origin: *` (checked 2026-10-27). Hangout.Audio (crinacle) is excluded: it blocks direct file requests and encrypts its data. Credit reads "[model] measured by [reviewer]".
- Targets: Harman IE 2019, Harman MoA 2025, JM-1 (10 dB tilt) from squig.link, PEQdB Diamond supplied by the owner. Bundled in `public/targets/`, loaded same-origin on toggle, all normalised to 0 dB at 1 kHz. Adding one is a file plus an entry in `src/core/targets.ts`.
- Supersedes the unmerged `phase-9-fr-overlay` branch (built before the editable graph); its core and picker were ported.
- Specs: `docs/agents/tasks/phase-9a-eq-editor.md` to `phase-9d-overlays-ui.md`.
- Next (2026-10-29): "Export other format" in OzyEQ: Wavelet GraphicEQ and an EqualizerAPO label (`phase-9-export-formats.md`). PipeWire was dropped because it needs a file path and a service restart we cannot check.

Exit: OzyEQ usable on an iPhone, an Android phone and an iPad (not yet checked on hardware); overlays drawn in both editors; tests, typecheck and build pass.

## Backlog (not scheduled)

- Squiglink: open the current EQ in Squiglink.
- AutoEQ to a target inside OzyEQ.
- Monetisation stays non-intrusive: PayPal donation link in the footer; optional cosmetic skins or mascot variants later. No ads.

Repo practice (2026-10-27): `main` is protected by a ruleset (PR required, CI `check` must pass, no force-push or deletion). Work on branches, merge with PR notes. MIT licence. Visitor counts via GoatCounter, cookie-free, dashboard behind the GoatCounter login.

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
