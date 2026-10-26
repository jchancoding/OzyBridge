```
Read @AGENTS.md first.

Task: Add FiiO KA15, SNOWSKY Melody and FiiO Oak Nano as config entries, marked "untested", with a landing caveat and a prefilled GitHub report link.
Phase: 7a (devicePEQ easy wins, agreed 2026-10-27)
Branch: feat/7a-devicepeq-models

Files you may change:
- src/devices/fiio/models.ts
- src/devices/fiio/models.test.ts (new)
- src/devices/fiio/__fixtures__/*.json (new, copied from devicePEQ tests/captures, 0BSD)
- src/ui/reportLink.ts, src/ui/reportLink.test.ts (new)
- src/App.tsx, src/App.css
- docs/protocol/fiio-btr17.md (short "Other models" section only)

Files to read for context (nothing else):
- src/devices/fiio/protocol.ts, src/devices/fiio/adapter.ts, src/devices/types.ts
- devicePEQ (via `gh api repos/jeromeof/devicePEQ/contents/<path>`): tests/captures/fiio_fiio_ka15.json, fiio_snowsky_melody.json, fiio_fiio_oak_nano.json and the matching tests/handlers/*.test.js

Model data (vendor 0x2972, report ID 7, firmwareCmd false, PK/LSC/HSC only, q 0.25-8, freq 20-20000, steps as BTR17, built-ins Jazz Pop Rock Dance R&B Classic Hip-hop at 0-6 read-only):
- FiiO KA15, 0x0104: 10 bands, gain and preamp -12..12, USER1-3 = 7, 8, 9, eqOff 10.
- SNOWSKY Melody, 0x0126: 10 bands, gain and preamp -12..12, USER1-3 = 160-162, eqOff 240.
- FiiO Oak Nano, 0x4016: 10 bands, gain and preamp -24..12, USER1 = 160, eqOff null.

Requirements:
1. Add `untested?: true` to `FiioModel` (after `firmwareCmd`) and set it on the three new entries.
2. models.test.ts: each product ID resolves; slot tables and eqOff match the data above; every reply frame in each capture parses with `parseReply`, and band/preamp replies decode with our decoders to the values devicePEQ's test expects. Oak Nano's capture lacks band 0; test what is there.
3. `src/ui/reportLink.ts`: `deviceReportUrl({ name, productId, firmware })` returns `https://github.com/jchancoding/OzyBridge/issues/new?title=...&body=...`, title `[device report] <name>`, body with model, product ID hex, firmware, and unchecked lines: connected and read slots / wrote one slot and it verified / still correct after unplug and replug / notes. URL-encoded. Test it.
4. App.tsx landing list: untested models get an "(untested)" suffix, plus one line under the list: "Untested models use settings from devicePEQ hardware captures. Every write is read back and checked, but nobody has confirmed them with OzyBridge yet." When an untested model is connected, show a banner above Workspace with the same caveat and a `Report how it went` link (`target="_blank" rel="noopener"`) from `deviceReportUrl`.
5. Replace the BTR17-specific disconnect and "pick the BTR17 control entry" texts with the connected model's name or "your device".
6. No new network calls. The report link is a user-clicked navigation only.

Out of scope:
- KA17, QX13 (separate task), JA11, any model without a capture, name-based matching, Workspace.tsx.

Done when:
- npm test and npm run typecheck pass
- Landing page lists four models, three marked untested.

Commit on the branch above. Do not push.
Reply with: files changed, test results, open issues. No explanations.
```

Outcome (planner, 2026-10-27): Oak Nano held back. Its capture reports 8 bands and suggests a +12 dB preamp offset. See docs/protocol/fiio-btr17.md.
