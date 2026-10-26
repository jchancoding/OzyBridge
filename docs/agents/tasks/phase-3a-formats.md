# Task: EQ file formats (Phase 3a)

Read `AGENTS.md` first.

Task: parse and export AutoEQ / Squiglink / Equalizer APO parametric text, and import FiiO's EQ XML. Pure TypeScript, test-first.
Phase: 3.

## Files you may create or change

- `src/core/autoeq.ts`, `src/core/autoeq.test.ts`
- `src/core/fiioXml.ts`, `src/core/fiioXml.test.ts`

## Files to read for context (nothing else)

- `AGENTS.md`
- `src/core/eq.ts` (types `EqBand`, `EqProfile`, `EqIssue`, `ImportResult`; do not edit)
- `src/core/__fixtures__/autoeq-a2000-10band.txt`
- `src/core/__fixtures__/BA15 REVJET.xml`

Load fixtures in tests with Vite raw imports, e.g. `import a2000 from './__fixtures__/autoeq-a2000-10band.txt?raw'`. Do not use `node:fs` (there are no Node types).

## Policy

Parsers do not fix files. They either return the profile exactly as written (`ok: true`), or return every problem found (`ok: false`, all errors, not just the first). Each `EqIssue.message` is a full plain-English sentence that tells the user what is wrong and what to change, e.g. `Line 4: low-pass filters (LP) aren't supported. Use peak (PK), low shelf (LSC) or high shelf (HSC).` Set `line` (1-based) for text and `band` (1-based) for XML. Device limits (band count, ranges) are NOT checked here. That is a separate fitting step.

## Requirements

1. `parseAutoEq(text: string): ImportResult` in `autoeq.ts`.
   - Case-insensitive and whitespace-tolerant (REW pads with multiple spaces, e.g. `Filter  1: ON  PK       Fc   63.0 Hz  Gain  -2.0 dB  Q  1.410`). Accept `\r\n`.
   - Filter line: `Filter <n>: ON|OFF <type> Fc <hz> Hz Gain <db> dB Q <q>`. Keep bands in file order; ignore `<n>`.
   - Type aliases: `PK`, `PEQ` → `PK`. `LSC`, `LSQ`, `LS` → `LSC`. `HSC`, `HSQ`, `HS` → `HSC`. All types require Fc, Gain and Q. A missing value is an error naming it.
   - `ON <unsupported type>` (`LP`, `HP`, `LPQ`, `HPQ`, `BP`, `NO`, `AP`, `LS 6dB`, `LS 12dB`, `HS 6dB`, `HS 12dB`, anything else) is an error. Name the type in words where known (low-pass, high-pass, band-pass, notch, all-pass, fixed-slope shelf).
   - `OFF` filters: parse into `enabled: false` if their fields are valid. If they are not, skip them silently. `Filter <n>: ON None` (REW's empty slot) is skipped silently.
   - `Preamp: <db> dB` sets `preamp`. Missing means 0. More than one Preamp line is an error.
   - `BW` / `BW Oct` instead of `Q` is an error saying to export with Q values.
   - Other non-empty lines (REW headers such as `Filter Settings file`, `Room EQ V5.31`, `Equaliser: Generic`, comments starting `#`) are ignored.
   - A malformed `Filter` line is an error. Zero enabled filters is an error: `No filters found. Paste or drop a parametric EQ text file (AutoEQ, Squiglink or REW format).`
   - Numbers must be finite and accept leading `+`. Frequency and Q must be > 0. `name` is always `null`. `notes` is `[]`, or one note per skipped OFF filter.
2. `exportAutoEq(profile: EqProfile): string`. `Preamp: X dB` then `Filter n: ON|OFF PK|LSC|HSC Fc F Hz Gain G dB Q Q`, numbered from 1, joined by `\n` with a trailing newline. Format numbers as `String(Number(v.toFixed(d)))` with d = 2 for gain and preamp, 3 for Q, 1 for Fc. Disabled bands are exported as `OFF`.
3. `parseFiioXml(text: string): ImportResult & { model?: string }`. Put `model` on the ok branch. In `fiioXml.ts`, use plain string/regex parsing; no `DOMParser` (core has no DOM).
   - Root must be `<FiiO_DSP ...>`, otherwise error `This isn't a FiiO EQ file.` Read the `model` attribute.
   - Band elements are `<eq index="i">` with `<param name="type|freq|gain|q">` children. `masterGain` → `preamp`. `styleName` → `name` (trimmed; null if absent/empty). Decode XML entities `&amp; &lt; &gt; &quot; &apos; &#n; &#xh;` in names.
   - Type `0` → `PK`, `1` → `LSC`, `2` → `HSC`. Any other value is an error. Missing/non-numeric params are errors naming the band and param. Duplicate or non-contiguous indices (must be 0..n-1) are errors. Sort by index. Every band is `enabled: true`, gain 0 bands included.
4. Tests (`autoeq.test.ts`, `fiioXml.test.ts`):
   - A2000 fixture parses to preamp -6.9 and exactly the 10 bands in the file (assert all fields of band 1 and band 10, types of all).
   - Round trip: `parseAutoEq(exportAutoEq(p))` deep-equals `p` for the A2000 profile and for a profile with a disabled band.
   - Exact export string for a 2-band profile.
   - REW-padded line, `\r\n`, lowercase, `+` gains, aliases (`LSQ`, `HS`, `PEQ`).
   - Each rejection rule: unsupported type, BW, missing Q, two Preamp lines, malformed line, no filters. Multiple problems in one file produce multiple errors with correct line numbers.
   - BA15 fixture: model `FIIO BTR17`, name `BA15 REVJET`, preamp -6, 10 bands, band 1 LSC 42 Hz +6 dB Q 0.87, band 6 HSC 5158 Hz -3 dB Q 0.8, bands 7-10 gain 0.
   - XML rejections: not FiiO, bad type `3`, missing `q`, duplicate index. Entity decoding in `styleName`.

## Out of scope

- Device limits, clamping, band count, rounding, preamp calculation (Phase 3b).
- A FiiO XML exporter, file pickers, drag-and-drop, any UI.
- Editing `src/core/eq.ts` or any other file.

## Done when

- `npm test` and `npm run typecheck` pass.
- No files outside the list above were created or changed.

Reply with: files changed, test results (counts), open issues. No explanations.
