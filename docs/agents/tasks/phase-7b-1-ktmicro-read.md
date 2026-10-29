Read AGENTS.md first.

Task: Add a read-only KTMicro adapter and its protocol doc.
Phase: 7b. Needs 7b-0 merged first.

Gate (planner, before launch): the owner's `?verify` probe of the Chu II DSP is in. devicePEQ's capture says Chu II is `0x31B2:0x0113`, while dac-peq-manager says `0x1112` or `0x0112`. Add Chu II to the model list only if the probe shows `0x0113`. If it shows `0x0112`, Chu II moves to spec 7b-3 and gets no KTMicro entry.

Work only in /Users/jasper/Documents/GitHub/OzyBridge-7b1 (branch 7b-ktmicro-read). Do not commit or push.

Files you may change:
- docs/protocol/ktmicro.md (new)
- src/devices/ktmicro/protocol.ts, protocol.test.ts, models.ts, models.test.ts, adapter.ts, adapter.test.ts (new)
- src/devices/ktmicro/__fixtures__/ (new; copy devicePEQ `tests/captures/ktmicro_*.json`, 0BSD, with credit in the doc)
- src/devices/registry.ts, src/devices/registry.test.ts (add `'ktmicro'`)
- src/App.tsx, src/ui/Verify.tsx (connect wiring only)

Sources: devicePEQ captures (0BSD) and gxcreator/ktmicro-tools (MIT) for register meanings. Facts only, no copied code. Never dac-peq-manager code.

Requirements:
1. Doc: frame layout from the captures (report ID `0x4B`; byte 0 is the register, byte 4 is the op: `0x52` read, `0x57` write, `0x53` commit). Register map for `0x24`, `0x26`-`0x2F` (5 bands, 2 registers each) and `0x66`. An allowlist table and a forbidden table, as in docs/protocol/walkplay.md.
2. Allowed in this slice: `0x52` reads of `0x24`, `0x26`-`0x2F` and `0x66`. Nothing else. The adapter refuses any other frame before it reaches the transport, and a test proves that. Forbidden (and named in the doc): any `0x57` write, `0x53` commit, writes to `0x11` and `0x66`, and `0x43` CLEAR. `writeSlot` throws `ReadOnlyDeviceError` (reuse the Walkplay one or move it to types.ts).
3. Models (exact vendor and product ID, never a fallback):
   - `0x31B2:0x0111`: one chip profile. The display name is the USB product name (for example "Kiwi Ears-Allegro Mini"). 5 bands, LSC/PK/HSC, ±12 dB, one slot, no preamp. `untested`.
   - `0x31B2:0x0113` Chu II DSP: only if the gate passed. `untested`.
   - Not added: JadeAudio JA11 (`0x2972:0x0102`). devicePEQ's capture uses FiiO framing (report 2, `AA 0A ... EE`), not KTMicro, so it stays on the held-back FiiO list. LS-TC2 (`0x2972:0x0107`) has no capture in any source, so it is recorded as wanted in ROADMAP.
4. Half-frequency quirk: decode supports a per-model `halfFreq` flag (frequency on the wire = Hz / 2). The captures say `compensate2X=false` for the models above, so the flag defaults to false. The doc says this is unconfirmed until the hardware check below.
5. Tests decode every band from each fixture and match devicePEQ's expected values. The adapter test runs a full read against a fake HID device built from a fixture.

Out of scope: writes, commits, preamp, any UI beyond connect wiring, models without a capture.

Done when:
- npm test and npm run typecheck pass in the worktree
- A test shows the adapter sends only allowlisted frames during connect and read

Hardware (owner, Allegro Mini, then Chu II): in the vendor's own app, set band 1 to PK 1000 Hz +3 dB Q 1 and close the app. In `?verify`, run the read step and paste the band 1 line. 1000 Hz means no quirk; 500 or 2000 Hz means it is real. Then unplug.

Reply with: files changed, test results, open issues. No explanations.
