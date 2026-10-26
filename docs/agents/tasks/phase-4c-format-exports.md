# Task: FiiO XML export, Squiglink two-channel rejection, flat-band omission (Phase 4c)

Read `AGENTS.md` first.

Task: add a FiiO XML exporter, reject two-channel Squiglink files with a clear message, and let the text exporter drop flat bands.
Phase: 4 (user-requested format addition; runs alongside the adapter task).

## Files you may change

- `src/core/fiioXml.ts`, `src/core/fiioXml.test.ts`
- `src/core/autoeq.ts`, `src/core/autoeq.test.ts`

## Files to read for context (nothing else)

- `AGENTS.md`
- `src/core/eq.ts`
- `src/core/__fixtures__/BA15 REVJET.xml` (the target output shape)

## Background

Squiglink's "Export" writes the same text as AutoEQ: `Preamp: X dB` then `Filter N: ON PK|LSC|HSC Fc F Hz Gain G dB Q Q`. It skips zero-gain filters. With two-channel EQ on, it writes `Channel: L` and `Channel: R` headers, each followed by its own `Preamp:` and filter list. Its importer reads frequency with `parseInt`.

## Requirements

1. `exportFiioXml(profile: EqProfile, opts: { model: string; name?: string; description?: string }): string`.
   - Same structure, element order, 2-space indentation and XML declaration as the fixture: `<FiiO_DSP model="…" version="0.0.1">`, `<module name="EQ">`, `<eqGroup>`, `masterGain` param, `<eqList>` with one `<eq index="i">` per band in order (params `type` as 0/1/2 for PK/LSC/HSC, then `freq`, `gain`, `q`), then `<styleName>` and `<description>` only when given. No trailing newline after `</FiiO_DSP>`.
   - Numbers are written in their shortest form, at most 2 decimals for gain and Q and 0 for frequency (`6`, `-3.2`, `0.87`). A disabled band is written with gain 0. `-0` is written as `0`.
   - Escape `& < > " '` in model, name and description.
2. `parseAutoEq`: if any line starts with `Channel:` (case-insensitive, leading whitespace allowed), return a single error and no other errors: `This file has separate EQ for the left and right channels. OzyBridge applies one EQ to both channels. Turn off two-channel EQ in Squiglink and export again.` Include the line number of the first `Channel:` line.
3. `exportAutoEq(profile, opts?: { omitFlat?: boolean })`. With `omitFlat: true`, skip disabled bands and bands whose gain rounds to 0, and number the remaining filters from 1. The default output is unchanged.
4. Tests:
   - Parsing the fixture and exporting it with its model, name and description reproduces the fixture file byte for byte.
   - Round trip: `parseFiioXml(exportFiioXml(p, …))` returns the same bands and preamp for a profile with all three filter types, a negative preamp and a disabled band (read back as enabled with gain 0).
   - Escaping: a name with `&<>"'` round-trips through `parseFiioXml`.
   - A two-channel Squiglink text (`Channel: L`, preamp, 2 filters, `Channel: R`, preamp, 2 filters) is rejected with the message above and the line number.
   - A one-channel Squiglink sample with CRLF line endings, `LSC`/`HSC`, integer `Fc` and gains with 4 decimals parses correctly.
   - `omitFlat` drops gain-0 and disabled bands and renumbers. The default keeps them.

## Out of scope

- UI, file pickers, filenames, downloads.
- Changing `parseFiioXml` behaviour or any existing error message.
- Other files, including `fit.ts`, `eq.ts`, docs.

## Done when

- `npm test` and `npm run typecheck` pass.
- No files outside the list above were changed.

Reply with: files changed, test results (counts), open issues. No explanations.
