Read AGENTS.md first.

Task: Enable KTMicro writes: `0x57` band writes, `0x53` commit, restart handling and read-back.
Phase: 7b. Needs 7b-1 merged and a passing read-only hardware report for the model.

Work only in /Users/jasper/Documents/GitHub/OzyBridge-7b2 (branch 7b-ktmicro-write). Do not commit or push.

Files you may change:
- docs/protocol/ktmicro.md
- src/devices/ktmicro/protocol.ts, protocol.test.ts, adapter.ts, adapter.test.ts, models.ts
- src/ui/Verify.tsx (only if the restart step from 7b-0 needs a KTMicro hook)

Requirements:
1. The allowlist adds `0x57` writes to `0x26`-`0x2F` and `0x53` commit (register `0x00`), matching the Allegro Mini capture byte for byte. Still forbidden: writes to `0x11`, `0x24` and `0x66`, `0x43` CLEAR, and any other register.
2. `writeBand(slot, index, band)`: read first, write that band's two registers, read them back, compare. No commit.
3. `writeSlot(slot, profile)`: read first, write all 5 bands, read back, compare, then `0x53` commit. Writes are fire-and-forget (no reply), so every write is followed by a read.
4. Never reshape. A profile that does not fit (more than 5 bands, out of range, unsupported type) is rejected before any frame is sent. With no preamp on the device, a curve that boosts above 0 dB is written as-is with a visible warning: "This device has no preamp. Loud passages may clip." Bands are never lowered.
5. Restart on commit: if the device disconnects after `0x53`, the adapter rejects with a typed `DeviceRestartedError`. Verify's restart step reconnects and reads back.
6. Tests: frame bytes for band writes and commit equal the capture fixture; a fake device that drops after commit gives `DeviceRestartedError`; a forbidden register throws before reaching the transport; a profile with 6 bands is rejected with zero frames sent.

Out of scope: preamp writes, `0x66`, Chu II unless its gate passed in 7b-1, other vendors.

Done when:
- npm test and npm run typecheck pass in the worktree

Hardware (owner, Allegro Mini first, one step per run, stop at the first fail):
1. `?verify` band step only: band 1 changes, read-back matches. Paste the band and restart lines.
2. Full slot: all 5 bands, commit, read-back matches. Paste the restart line, which says "permission kept" or "chooser needed".
3. Unplug for 10 s, plug in, run the read step. The bands from step 2 must still be there.

Reply with: files changed, test results, open issues. No explanations.
