Read AGENTS.md first.

Task: Add Walkplay schemes 15, 16 and 18 to the read-only Walkplay adapter, one model entry per devicePEQ capture, all untested. No writes.
Phase: 7b

Work only in /Users/jasper/Documents/GitHub/OzyBridge-wp-schemes (branch walkplay-schemes). Never touch /Users/jasper/Documents/GitHub/OzyBridge. Do not commit or push.

Files you may change:
- docs/protocol/walkplay.md
- src/devices/walkplay/protocol.ts, protocol.test.ts
- src/devices/walkplay/models.ts, models.test.ts
- src/devices/walkplay/adapter.ts, adapter.test.ts
- src/devices/walkplay/__fixtures__/*.json (new, copied from devicePEQ, 0BSD)
- src/transport/webhid.ts (requestConnectDevices filter only)
- src/App.tsx (WALKPLAY_NOTE text only, if it names one model)

Files to read for context: the files above, AGENTS.md, src/devices/types.ts, src/core/eq.ts.

Upstream (gh api repos/jeromeof/devicePEQ/contents/<path> --jq .content | base64 -d). Do not open walkplayJS/ or walkplayPreprocessor/walkplay.js.
- devicePEQ/usbDeviceConfig.js (SchemeNo15, 16, 18 groups and named model overrides only)
- devicePEQ/peqConstraintsConfig.json (the profiles those groups reference)
- devicePEQ/walkplayHidHandler.js (parseFilterPacket only)
- tests/captures + tests/handlers for: walkplay_schemeno15_ddhifi_dsp_cable, walkplay_schemeno15_tanchjim_stargate_ii, walkplay_schemeno16_protocol_max, walkplay_schemeno16_tp35_pro, walkplay_schemeno16_tanchjim_space_pro, walkplay_schemeno18_nicehck_octave

Requirements:
1. Models are keyed by vendorId + productId. The model list now spans more than one vendor (these captures use 0x3302); findWalkplayModel must match both fields, not only 0x35D8.
2. One entry per capture, using the capture's productName, vendorId, productId. Band count, filter types (PK, LSC, HSC as allowed) and gain range from the referenced constraint profile and any per-model override (Stargate II and Space Pro are PK-only). Slot: id 101 "Custom". untested: true.
3. Decode type byte 1 as LSC, 2 as PK, 3 as HSC. Any other type byte (LP, HP) must throw ProtocolError on read, not silently become PK. Update the Marigold path accordingly and keep its tests passing.
4. No frequency or Q compensation for these schemes. Do not add scheme 11.
5. Allowlist unchanged: reads 0x0C, 0x09, 0x03 only. Writes still throw and send nothing.
6. Tests: each capture replays through the adapter, and each decoded profile equals the values devicePEQ's test expects (or the capture's metadata) for every band. One test that an LP/HP type byte throws.
7. requestConnectDevices adds the new vendor id(s). ?bench and ?probe choosers unchanged.
8. Protocol doc: add the schemes table (scheme, bands, types, models) and the type-byte rule.

Out of scope: scheme 11, compensation, writes, other vendors, UI changes beyond the note text.

Done when:
- npm test and npm run typecheck pass in the worktree
- Reply with: files changed, one line per model (name, vid:pid, bands, types), test results, open issues. No explanations.
