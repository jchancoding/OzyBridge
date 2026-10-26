# Task: filter response math and device fitting (Phase 3b)

Read `AGENTS.md` first.

Task: compute the EQ magnitude response for the graph, and check that a profile fits a device's limits. Fitting either rejects the profile with plain-language reasons, or returns it rounded to the device's precision with a safe preamp.
Phase: 3.

## Files you may create or change

- `src/core/response.ts`, `src/core/response.test.ts`
- `src/core/fit.ts`, `src/core/fit.test.ts`

## Files to read for context (nothing else)

- `AGENTS.md`
- `src/core/eq.ts` (types `EqBand`, `EqProfile`, `EqLimits`, `EqIssue`, `flatBand`, `profilesEqual`; do not edit)

## Requirements

1. `response.ts`, using the RBJ Audio EQ Cookbook (the convention AutoEQ and Equalizer APO use):
   - `A = 10^(gain/40)`, `w0 = 2*pi*f0/fs`, `alpha = sin(w0)/(2*Q)` for all three types, so shelves take Q directly and the shelf gain at f0 is gain/2.
   - `biquad(band: EqBand, fs: number): { b0; b1; b2; a1; a2 }` normalised by a0.
   - `logFrequencies(n: number, min = 20, max = 20000): number[]`, log-spaced and including both ends.
   - `bandResponseDb(band, freqs, fs = 48000): number[]` is the magnitude in dB, evaluated exactly from the coefficients at `z = e^{jw}`. A disabled band or gain 0 gives all zeros.
   - `profileResponseDb(profile, freqs, fs = 48000, includePreamp = true): number[]` is the sum of the bands, plus the preamp if included.
2. `fit.ts`: `fitProfile(profile: EqProfile, limits: EqLimits, fs = 48000)` returns `{ ok: true; profile: EqProfile; notes: string[] } | { ok: false; errors: EqIssue[] }`.
   - Policy: never alter the user's EQ to make it fit. Any violation means a rejection that lists every problem. Messages are full plain-English sentences that say what to change. Set `band` (1-based, counting enabled bands in order) where relevant.
   - Steps, in order:
     1. Drop disabled bands. If any were dropped, add the note `Skipped N filter(s) marked OFF.`
     2. Round each band to `limits.step`: gain to 0.1, Q to 0.01, frequency to 1. Round half away from zero, and avoid float noise (`Math.round(v/step)*step` then fix to the step's decimals).
     3. Validate the rounded bands. Count over `maxBands`: `This EQ has 15 active filters, but the device has 10 bands. Remove 5 filters and import again.` A type not in `filterTypes`, and gain, Q or frequency outside the range: one error each, e.g. `Filter 3: gain +14.0 dB is above the device maximum of +12.0 dB.` Show `+` on positive gains.
     4. If there are any errors, return them all (count, type and range errors together).
     5. Auto preamp. Compute the peak of `profileResponseDb(bands, grid, fs, false)`. The grid is `logFrequencies(2000)` plus every band's own frequency, limited to [20, 20000]. `needed = -max(0, peak)`. `preamp = min(profile.preamp, needed)`, rounded down (toward more negative) to `step.gain`, again avoiding float noise. If the preamp is below `limits.preamp.min`, reject with `This EQ needs X dB of preamp to avoid clipping, but the device only goes down to Y dB. Reduce the boost on your largest filters.` If `profile.preamp` itself is above `limits.preamp.max`, reject too. If the preamp ended up lower than the file's, add the note `Preamp lowered from A dB to B dB to prevent clipping.`
     6. If rounding changed any value, add one note: `Rounded to device precision (gain 0.1 dB, Q 0.01, frequency 1 Hz).` Take the numbers from `step`.
     7. Pad to `maxBands` with `{ ...flatBand(f), enabled: false }`, where `f` is `limits.defaultFreqs[i]` if present and 1000 otherwise. Padding produces no note.
3. Tests:
   - `response.test.ts`: a PK at f0 equals its gain (to 1e-6) and is about 0 dB at 20 Hz for f0 = 4 kHz, Q 2. An LSC is about its gain at 20 Hz for f0 = 1 kHz, about gain/2 at f0, and about 0 at 20 kHz. An HSC is the mirror of that. Gain 0 and a disabled band are zero everywhere. Response is additive and the preamp shifts the curve. `logFrequencies(3)` is `[20, ~632.46, 20000]`.
   - `fit.test.ts`: use the BTR17 test limits `{ maxBands: 10, filterTypes: ['PK','LSC','HSC'], gain: {min:-24,max:12}, preamp: {min:-24,max:12}, q: {min:0.25,max:8}, freq: {min:20,max:20000}, step: {gain:0.1,q:0.01,freq:1}, defaultFreqs: [32,64,125,250,500,1000,2000,4000,8000,16000] }`.
     - The A2000 profile, written inline in the test (preamp -6.9, LSC 22 Hz 6.61 dB Q 0.73, PK 43 0.99 0.463, PK 163 -5.44 0.513, PK 370 -1.47 0.998, PK 780 0.66 2.056, PK 1513 -3.2 0.789, PK 2469 5.11 1.023, PK 7320 -3.82 1.583, HSC 11218 -0.81 2.083, PK 15329 -4.6 0.887), comes back ok with 10 bands. Band 1 is gain 6.6 and Q 0.73. Band 2 is Q 0.46. The rounding note is present. The preamp is ≤ -6.9 and its fitted curve peaks ≤ 0 dB (+1e-9).
     - Rejections: 11 enabled bands (while 11 disabled plus 10 enabled is ok). +12.06 dB is rejected because it rounds to 12.1, and +12.04 dB passes. Also reject Q 0.2, frequency 25000, an unsupported type (use limits without `HSC`), and a preamp that needs more than 24 dB. Several problems give several errors.
     - Padding: a 3-band profile comes back with 10 bands, padded bands disabled at 250, 500, … 16000 Hz. `profilesEqual` between the fitted profile and the same bands written with gain 0 and enabled true is true.
     - Preamp: a lone +6 dB PK gives preamp ≤ -6.0 and the lowered note. A file preamp of -10 with the same band keeps -10 and no note.

## Out of scope

- Parsing files, the graph UI, device I/O, Q compensation.
- Editing `src/core/eq.ts` or any other file.

## Done when

- `npm test` and `npm run typecheck` pass.
- No files outside the list above were created or changed.

Reply with: files changed, test results (counts), open issues. No explanations.
