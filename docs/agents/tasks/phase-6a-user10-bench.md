# Task: bench steps for USER10 persistence (Phase 6a)

Read @AGENTS.md first.

Task: add one batched persistence test to the bench so the user can answer all USER10 questions in a single power-cycle session.
Phase: 6 (hardening). Closes the open USER10 issue in `docs/ROADMAP.md` Phase 4.

Files you may change:
- `src/ui/Bench.tsx`

Files to read for context (nothing else):
- `docs/protocol/fiio-btr17.md` (write sequence, bench results)
- `src/devices/fiio/adapter.ts` (`DEFAULT_FIIO_TIMING`, `writeSlot`)
- `src/devices/types.ts`

Background: after a power cycle USER1 keeps written bands, USER10 (`0xA9`) keeps the new preamp but the old bands. The bench's `writeAndRestoreActive` switches back to the original slot after writing. Untested idea: leave the written slot active until unplug.

Requirements:
1. Add a "6. Persistence test" section with a variant select, one button and a "Verify after power cycle" button.
2. Variants (each writes the fitted A2000 profile to USER10, the existing `fullWrite` data):
   - A: write, leave USER10 active, no switch back.
   - B: same as A, but with `afterSaveMs` 3000 (connect-time option, so add a number field like the existing `afterPreampMs` field).
   - C: write, switch back to the original slot (current behaviour), for a control.
3. After a variant write, store `{variant, expected profile, expectedActive}` in localStorage and log: `UNPLUG NOW: variant X`.
4. "Verify after power cycle" reads the active slot and USER10, compares with the stored expectation using `profilesEqual`, and logs exactly these lines and nothing else new:
   `RESULT variant=X active=<id> bands=<PASS|FAIL> preamp=<PASS|FAIL>`
   Do not clear the stored expectation until the user clicks Clear log.
5. Do not change any adapter behaviour or timing defaults.

Out of scope:
- Any change to `adapter.ts`, protocol, or new commands (never send `0x21`).
- Capturing FiiO Control traffic.
- Main app UI.

Done when:
- `npm test` and `npm run typecheck` pass.
- Bench still builds (`npm run build`).

Reply with: files changed, test results, open issues. No explanations.
