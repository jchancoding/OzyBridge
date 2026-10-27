# Phase 9a: measurement core

```
Read @AGENTS.md first.

Task: Pure TypeScript for parsing frequency-response measurements and squiglink indexes, and for computing the equalized curve.
Phase: 9 (docs/ROADMAP.md)

Files you may change:
- src/core/measurement.ts (new)
- src/core/measurement.test.ts (new)
- src/core/squiglink.ts (new)
- src/core/squiglink.test.ts (new)

Files to read for context (nothing else):
- src/core/response.ts
- src/core/eq.ts

Requirements:
1. measurement.ts exports `interface Measurement { f: number[]; db: number[] }`.
2. `parseMeasurement(text: string): Measurement`. Accepts REW / squiglink .txt and .csv: skip lines starting with `*`, `#`, or not starting with a number; split on tab, comma, semicolon or spaces; take column 1 = Hz, column 2 = dB, ignore the rest (phase). Drop non-finite or f <= 0 rows, sort by f, drop duplicate f. Throw `Error('No frequency response data found')` if fewer than 10 points, and `Error('Measurement does not cover 100 Hz-10 kHz')` if the range misses that span.
3. `averageChannels(a: Measurement, b: Measurement): Measurement`: resample b onto a.f, average dB.
4. `resampleLog(m: Measurement, freqs: number[]): number[]`: linear interpolation in log10(f); hold the edge values outside the measured range.
5. `normalizeAt(db: number[], freqs: number[], hz = 1000): number[]`: shift so the curve is 0 dB at `hz` (interpolated).
6. `equalizedResponse(m: Measurement, profile: EqProfile, freqs: number[]): { original: number[]; equalized: number[] }`. original = normalizeAt(resampleLog(m, freqs), freqs); equalized = original + profileResponseDb(profile, freqs, 48000, true) element-wise. The equalized curve shares the original's 1 kHz offset (do not renormalize it).
7. squiglink.ts exports types `SquigDb { reviewer: string; type: string; baseUrl: string }` and `SquigModel { brand: string; name: string; variants: { label: string; file: string }[] }`.
8. `parseSquigSites(json: unknown): SquigDb[]`. Input is the array from https://squig.link/squigsites.json: entries `{ username, name, urlType, altDomain?, dbs: [{ type, folder }] }`. Base URL by urlType: subdomain = `https://${username}.squig.link${folder}`, labFolder = `https://squig.link/lab/${username}${folder}`, altDomain = `${altDomain}${folder}`, root = `https://squig.link${folder}`. baseUrl always ends with `/`. Skip malformed entries, unknown urlTypes and any URL not starting with `https://`. Sort by reviewer name, case-insensitive.
9. `parsePhoneBook(json: unknown): SquigModel[]`. Input is an array of `{ name: brand, phones: [...] }`. A phone is either a string (name = file = the string) or `{ name, file, suffix? }` where file is a string or string[] and suffix (optional) is a parallel string[]. One variant per file; label = suffix[i] if present, else the file name when there are several files, else ''. Skip brands named `_EQ` or starting with `_`, and malformed entries. Sort by brand then name.
10. `measurementUrls(baseUrl: string, file: string): [string, string]`: `${baseUrl}data/${encodeURIComponent(file + ' L')}.txt` and the R equivalent.
11. Tests cover each function, including: a REW header block, CSV input, both errors, edge hold in resampleLog, normalizeAt hitting 0 at 1 kHz, equalizedResponse with a flat profile (equalized == original) and with a +6 dB preamp, every urlType, a phone with file array + suffix, a string phone, `_EQ` skipped, and URL encoding of spaces.

Out of scope:
- Any fetch, DOM or UI code. No changes to existing files.

Done when:
- npm test and npm run typecheck pass

Reply with: files changed, test results, open issues. No explanations.
```
