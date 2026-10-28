# OzyBridge context

Current state for people and agents. Phase history lives in [`docs/ROADMAP.md`](docs/ROADMAP.md). How to work in the repo lives in [`AGENTS.md`](AGENTS.md). The public intro is [`README.md`](README.md).

`docs/ROADMAP.md` still says Phase 7b is on hold. That line predates PRs #21–#25. Use this file for what is on `main`.

## Product

Login-free static site that writes parametric EQ to USB DACs and amps over WebHID. Users bring curves from Squiglink, AutoEQ, or PeqDB, or build them in OzyEQ (`?eq`), the same editor without a device, which works on any browser including phones.

Live: https://jchancoding.github.io/OzyBridge/

## Status (2026-10-27, `main`)

- Phases 0–6 (BTR17 MVP, GitHub Pages) are closed.
- Phase 7a is closed: preset library, share links, compare, one-level undo, export-all JSON, KA15, SNOWSKY Melody, KA17, QX13.
- Phase 7b is in progress on `main`: read-only Walkplay adapter (schemes 10, 15, 16, 18), `?verify` device test, feedback via FormSubmit, device-neutral landing copy.
- Phase 8 (Mirage) is closed: dark and light tokens, glass chrome, motion toggle, Ozy mascot. Skins were skipped.
- Phase 9 (branch `phase-9-ozyeq`): OzyEQ at `?eq`, landing without WebHID, shared `EqEditor`, squiglink measurement overlay, bundled target curves. Not yet checked on phones.

Only the FiiO BTR17 is treated as hardware-verified. Every other listed model is `untested`.

## Devices

Vendor `0x2972` unless noted. `untested` models are config entries checked against devicePEQ captures, not confirmed with OzyBridge on hardware.

| Model | Writes | Notes |
| --- | --- | --- |
| FiiO BTR17 (`0x0088`) | yes | 10 bands, USER1–10 = slots 160–169, EQ off = 240, save `0x19`. The only verified model. |
| FiiO KA15 (`0x0104`), SNOWSKY Melody (`0x0126`) | yes, untested | 10 bands, ±12 dB. |
| FiiO KA17 (`0x0093`), FiiO QX13 (`0x0128`) | yes, untested | Peaking Q correction in `src/core/qCompensation.ts`: `Q_wire = Q * 10^(|gain|/40)`. Shelves are not corrected. |
| MOONDROP Marigold (`0x35D8:0x011C`) | no | Walkplay scheme 10. 8 bands, PK only, ±10 dB. |
| ddHiFi DSP Cable - Memory, TANCHJIM-STARGATE II, CrinEar Protocol Max, EPZ TP35 Pro, TANCHJIM-SPACE PRO, NiceHCK Octave (`0x3302`) | no | Schemes 15, 16, 18. One Custom slot (id 101). See `docs/protocol/walkplay.md`. |

Not in the model list yet: FiiO BTR13, Oak Nano, JadeAudio JA11, and the larger FiiO legacy set. Walkplay writes are not enabled.

## Behaviour that is easy to get wrong

- Import never reshapes a file to make it fit. Too many bands, out-of-range values, or unsupported filter types are rejected. Fitting only rounds, pads, and lowers the preamp when the curve passes 0 dB.
- FiiO writes: preamp, then all bands, then save `0x19`. `0x21` is FiiO's factory reset and is forbidden. Sets get no reply. Every write is verified by a read.
- Leave the written FiiO slot active. Switching away before unplug can drop USER bands.
- Slot names and the preset library (`ozy-presets`) live in the browser. The BTR17 stores no names. Names are matched by a preamp+band fingerprint.
- No auto-reconnect. The BTR17 has no USB serial, so Chrome drops the WebHID permission on unplug.
- `?probe` redirects to `?verify`. `?bench` is the low-level adapter page. `?feedback` is the general form.
- Adding a model on a known protocol is a config entry. A new vendor is one `DeviceAdapter`.

## Layout

- `src/core/` EQ model, parsers, fit, share links, presets, reports. No DOM, no WebHID.
- `src/transport/` WebHID only. Bytes in, bytes out.
- `src/devices/fiio/` and `src/devices/walkplay/` protocol plus per-model config.
- `src/ui/` React. Devices only through `DeviceAdapter`. `EqEditor` is shared by the device workspace and OzyEQ.

## Network

No backend in this repo. Three runtime calls, all documented in `AGENTS.md`:

- Production page views to GoatCounter (`src/analytics.ts`): path and referrer only. Skipped when Do Not Track is on. Never device or EQ data.
- User-initiated FormSubmit posts (`src/ui/submit.ts`) for feedback and `?verify` reports. The report is the text already on screen.
- User-initiated squiglink GETs (`src/ui/squiglink.ts`) when the IEM picker opens. Target curves are same-origin files in `public/targets/`.

## Still open

- A passing `?verify` report on hardware before any `untested` model is promoted.
- Walkplay writes, after a read-only pass on a real device.
- BTR13 and the held-back FiiO models.
- Connected-device pass of the Phase 8 motion (hover, boot stagger, scan sweep) and a BTR17 smoke test in both themes.
- FiiO Control conflict copy has not been confirmed on hardware.

Protocol notes: `docs/protocol/fiio-btr17.md`, `docs/protocol/walkplay.md`. Do not read `captures/` unless the task says to.
