# Phase 9b: overlay and free-mode core

```
Read @AGENTS.md first. Work only in /Users/jasper/Documents/GitHub/OzyBridge-9b (a git worktree). Do not commit.

Task: Finish the pure-TypeScript core for frequency-response overlays, bundled target curves, and the no-device EQ limits.
Phase: 9

Files you may change:
- src/core/measurement.ts, src/core/measurement.test.ts (already ported from an older branch; tests pass)
- src/core/targets.ts (new), src/core/targets.test.ts (new)
- src/core/freeLimits.ts (new), src/core/freeLimits.test.ts (new)

Files to read for context (nothing else):
- src/core/eq.ts, src/core/response.ts (exports only), src/core/fit.ts (fitProfile signature), src/core/squiglink.ts
- public/targets/ (four bundled target files; do not edit them)

Requirements:
1. measurement.ts: `equalizedResponse` must add the EQ response WITHOUT preamp (`profileResponseDb(profile, freqs, 48000, false)`), so the equalized curve stays aligned with targets. Update its test. Keep the other exports unchanged.
2. targets.ts: export `interface TargetCurve { id: string; name: string; file: string }` and `TARGETS: TargetCurve[]` in this order:
   - `harman-ie-2019`, "Harman IE 2019", `Harman IE 2019.txt`
   - `harman-moa-2025`, "Harman MoA 2025", `Harman MoA 2025.txt`
   - `jm1-10db`, "JM-1 (10 dB tilt)", `JM-1 10dB Tilt.txt`
   - `peqdb-diamond`, "PEQdB Diamond", `PEQdB Diamond.txt`
   Export `targetUrl(base: string, t: TargetCurve): string` returning `${base}targets/${encodeURIComponent(t.file)}` (base is Vite's BASE_URL, ends with `/`). Export `targetCurve(m: Measurement, freqs: number[]): number[]` returning the target resampled to `freqs` and normalized to 0 dB at 1 kHz (use resampleLog and normalizeAt).
3. targets.test.ts: read each bundled file with `node:fs` (path from `process.cwd()`), check it parses with parseMeasurement, covers at most 20 Hz to at least 20 kHz, and `targetCurve(...)` at 1000 Hz is 0 (within 1e-9). Check ids are unique and `targetUrl('/OzyBridge/', TARGETS[0])` is `/OzyBridge/targets/Harman%20IE%202019.txt`.
4. freeLimits.ts: export `FREE_LIMITS: EqLimits` = 10 bands, filter types PK/LSC/HSC, gain -12..12, preamp -24..12, Q 0.1..10, freq 20..20000, step gain 0.1 / q 0.01 / freq 1, defaultFreqs [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]. No qLaw. Export `emptyProfile(limits: EqLimits): EqProfile`: preamp 0 and exactly `limits.maxBands` flat bands (use `flatBand` from eq.ts), frequencies from `limits.defaultFreqs` when present, otherwise log-spaced between 32 Hz and 16 kHz rounded to whole Hz.
5. freeLimits.test.ts: emptyProfile gives 10 bands for FREE_LIMITS and 8 for a copy with maxBands 8 and no defaultFreqs (frequencies strictly increasing, all within freq range); `fitProfile(emptyProfile(FREE_LIMITS), FREE_LIMITS).ok` is true.

Out of scope:
- UI, fetching, src/devices, src/transport, public/. No new dependencies.

Done when:
- npm test and npm run typecheck pass

Reply with: files changed, test results, open issues. No explanations.
```
