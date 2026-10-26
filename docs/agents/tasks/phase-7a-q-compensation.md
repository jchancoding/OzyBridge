```
Read @AGENTS.md first.

Task: Add FiiO KA17 and QX13, which need a gain-dependent peaking Q correction, as "untested" config entries.
Phase: 7a (devicePEQ easy wins, agreed 2026-10-27)
Branch: feat/7a-q-compensation

Planner-checked math (do not change it):
- Peaking (PK) only: the device realises Q_sent / A, A = 10^(|gain dB| / 40). Write Q_wire = Q * A, read Q = Q_wire / A. Gain 0 means no change.
- Shelves (LSC/HSC): NO correction. devicePEQ's `shelfCompensation: peakingAlpha` converts from a slope (S) convention. Our `src/core/response.ts` and AutoEQ already use the Q-form RBJ shelf the device realises. Do not port it.
- Fitting never alters a file: if Q_wire rounded to 0.01 falls outside the device Q range, reject with a plain reason ("Band 3: Q 7 at +12 dB needs Q 14 on this device; the most it takes is 8. Lower the Q or the gain."). No clamping.

Files you may change:
- src/core/qCompensation.ts, src/core/qCompensation.test.ts (new)
- src/core/eq.ts (optional `qLaw?: 'rbjGain'` on EqLimits), src/core/fit.ts, src/core/fit.test.ts
- src/devices/fiio/adapter.ts, src/devices/fiio/adapter.test.ts, src/devices/fiio/fakeFiioHid.ts
- src/devices/fiio/models.ts

Files to read for context (nothing else):
- src/core/response.ts, src/devices/types.ts, src/devices/fiio/protocol.ts
- devicePEQ (via `gh api repos/jeromeof/devicePEQ/contents/<path>`): tests/handlers/fiio_fiio_ka17.test.js, fiio_fiio_qx13.test.js (expected values only)

Model data (vendor 0x2972, firmwareCmd false, PK/LSC/HSC only, q 0.25-8 on the wire, freq 20-20000, steps as BTR17, `qLaw: 'rbjGain'`, `untested: true`; add `untested?: true` to FiioModel after `firmwareCmd`):
- FiiO KA17, 0x0093, report ID 1: 10 bands, gain and preamp -12..12. Slots read-only Jazz 0, Pop 1, Rock 2, Dance 3, R&B 5, Classic 6, Hip-hop 7; writable USER1 4, USER2 8, USER3 9. eqOff 10. Keep this odd order.
- FiiO QX13, 0x0128, report ID 7: 10 bands, gain and preamp -24..12. Read-only 0-6 (Jazz Pop Rock Dance R&B Classic Hip-hop) and Retro 8; writable USER1-10 = 160-169; eqOff 240.

Requirements:
1. qCompensation.ts: `toWireProfile(profile, law, qStep)` and `fromWireProfile(profile, law, qStep)`, both rounding Q to qStep, plus a fit helper giving the wire Q per band. Tests: identity without law, shelves untouched, gain 0 untouched, +6 dB Q 1 gives 1.41 on the wire, -12 dB uses |gain|, the round trip stays within one step.
2. fit.ts: with `qLaw`, check wire Q against `limits.q` and reject as above. Tests for pass and reject.
3. adapter.ts: with `qLaw`, guard and write use the wire profile, read-back is compared on the wire, and `readSlot`, `readActiveProfile` and `writeSlot` return user-facing (from-wire) profiles. BTR17 behaviour must not change (all existing tests pass unchanged).
4. Adapter tests with the fake HID set to KA17 (report ID 1) and QX13: a write sends Q*A for PK, untouched shelves, and returns the user-facing Q.

Out of scope:
- KA15, Melody, Oak Nano, landing-page text, report links (separate task), UI files, JA11.

Done when:
- npm test and npm run typecheck pass

Commit on the branch above. Do not push.
Reply with: files changed, test results, open issues. No explanations.
```
