Read AGENTS.md first.

Task: Read-only Walkplay adapter for Scheme 10 (Moondrop Marigold), flagged untested. No writes.
Phase: 7b

Files you may change:
- docs/protocol/walkplay.md
- src/devices/walkplay/protocol.ts
- src/devices/walkplay/protocol.test.ts
- src/devices/walkplay/models.ts
- src/devices/walkplay/models.test.ts
- src/devices/walkplay/adapter.ts
- src/devices/walkplay/adapter.test.ts
- src/devices/walkplay/__fixtures__/walkplay_default_moondrop_marigold.json
- src/transport/webhid.ts
- src/App.tsx

Files to read for context (nothing else in this repo):
- AGENTS.md
- docs/protocol/fiio-btr17.md (shape of a protocol doc only)
- src/devices/types.ts
- src/devices/fiio/adapter.ts
- src/devices/fiio/adapter.test.ts
- src/transport/webhid.ts
- src/App.tsx
- src/core/eq.ts

Upstream (0BSD, jeromeof/devicePEQ). Fetch with gh. Do not clone into this repo. Do not open walkplayJS/ or walkplayPreprocessor/walkplay.js (multi-megabyte).
- testing/protocol-docs/walkplayHIDHandler.md
- devicePEQ/walkplayHidHandler.js (pull/decode path only)
- tests/captures/walkplay_default_moondrop_marigold.json (copy into the fixture path above)

Requirements:
1. Create git branch walkplay-readonly from current HEAD. Do not commit. Do not push.
2. Protocol doc: report id 0x4B. Read direction byte 0x80. Document only the reads this slice sends: firmware 0x0C, PEQ 0x09, global gain 0x03. State that writes (0x01 direction), save steps 0x05, 0x17, 0x0A, and flash 0x01 are forbidden until a later verified slice. Credit devicePEQ.
3. Allowlist: building any other command throws. Encode the three reads to match the Marigold capture sends exactly.
4. Decode PEQ replies into EqBand (type, freq, gain, q) using the same math as devicePEQ's pull path for scheme 10 (no freq/Q compensation). Bands are biquad coefficients on the wire, not raw freq/gain.
5. Model: MOONDROP Marigold, vendor 0x35D8, product 0x011C, untested, one writable slot id 101 label Custom, 8 bands, PK only, gain ±10 dB, preamp 0 (device does not store preamp; do not map global gain into preamp).
6. Adapter implements DeviceAdapter. readActiveProfile and readSlot(101) return the decoded profile. getActiveSlot returns 101. setActiveSlot and writeSlot throw and send nothing. Tests replay the fixture and assert the eight decoded bands (exact values, with a tight tolerance).
7. Connect: WebHID filter stays the FiiO filter plus this one vendor id. Landing list shows the Marigold as "(untested)". Existing FiiO connect still works. Do not restyle.

Out of scope:
- Other schemes, other models, compensation, mic gain, DAC extras, writes, probe page, preset library.

Done when:
- npm test and npm run typecheck pass
- Reply with: files changed, decoded band values, test results, open issues. No explanations.
