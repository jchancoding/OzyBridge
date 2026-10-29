Read AGENTS.md first.

Task: Identify the borrowed Moondrop May or FreeDSP cable, then add a read-only Moondrop adapter (and later a write slice) for it, separate from the Walkplay-path Moondrop models.
Phase: 7b. Needs 7b-0 merged.

Gate (planner, before launch): the owner's `?verify` probe of the cable. Pick a branch:
- `0x35D8:0x98D3` (FreeDSP Pro) or `0x98D4` (FreeDSP Mini): go ahead. Protocol is report `0x4B` with host-computed coefficients, already in docs/protocol/moondrop.md.
- `0x35D8:0x1496` (FreeDSP, Conexant): stop. devicePEQ's capture shows it is write-only with no replies, so read-back is impossible under our rules. Record it as blocked in ROADMAP.
- `0x31B2:0x0112` or anything else: stop. No source we may use (devicePEQ, Hub_Moon, Moondrop's web tool, checked 2026-10-29) knows this ID. Bring the descriptor back to the planner.

Work only in /Users/jasper/Documents/GitHub/OzyBridge-7b3 (branch 7b-moondrop-dsp). Do not commit or push.

Files you may change (read-only slice):
- docs/protocol/moondrop.md
- src/devices/moondrop/protocol.ts, protocol.test.ts, models.ts, models.test.ts, adapter.ts, adapter.test.ts (new)
- src/devices/registry.ts, registry.test.ts (add `'moondrop'`)
- src/App.tsx, src/ui/Verify.tsx (connect wiring only)

Sources: docs/protocol/moondrop.md, MiyukiVigil/Hub_Moon (MIT) for facts only. Marigold stays in src/devices/walkplay/.

Requirements (read-only slice):
1. Allowed: `80 0C` firmware, `80 0F` active preset, `80 09` band reads, pre-gain read. Everything else is refused before the transport, with a test. Forbidden, named in the doc: `0x05` FLASH_CLEAR, `0xFF` UPGRADE_ENTER, VID 1638 / PID 2184, and all `0x01` writes in this slice.
2. Model by exact product ID: 8 bands, `peqIndex` 7, pre-gain per the model table in moondrop.md (FreeDSP Pro has none). `untested`.
3. Decode reply offsets 27 to 33 as in the doc. Test against the Marigold fixture in src/devices/walkplay/__fixtures__/, since the reply layout is shared.

Write slice (a second spec from the planner, after a passing read-only report): RBJ coefficients at 96 kHz in `src/core/` with Vitest values, then band write `01 09`, read-back, `EQ_SAVE_FLASH`, read-back. The meaning of `peqIndex` gets confirmed first, by reading only.

Out of scope: Conexant devices, Marigold changes, writes in the first slice.

Done when:
- npm test and npm run typecheck pass in the worktree

Hardware (owner): read-only. In Moondrop's own tool, set band 1 to PK 1000 Hz +3 dB Q 1, close it, then run the `?verify` read step and paste the band 1 and firmware lines.

Reply with: files changed, test results, open issues. No explanations.
