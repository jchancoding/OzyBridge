```
Read @AGENTS.md first.

Task: Add a one-click "Export all slots" that downloads every user slot's EQ and name as one JSON file.
Phase: 7a
Branch: feat/7a-export-all

Files you may change:
- src/core/backup.ts (new)
- src/core/backup.test.ts (new)
- src/ui/Workspace.tsx

Files to read for context (nothing else):
- src/core/eq.ts
- src/core/slotNames.ts
- src/devices/types.ts
- docs/design/STYLEGUIDE.md

Requirements:
1. `src/core/backup.ts` exports `serializeSlotBackup({ product, slots })` where `slots` is `{ id, label, name, profile: EqProfile }[]`. Output is pretty JSON: `{ "app": "OzyBridge", "kind": "slot-backup", "version": 1, "product", "exportedAt" (ISO string, passed in so tests are deterministic), "slots": [...] }`. Slot order is preserved.
2. Also export `parseSlotBackup(text)` returning `{ ok: true, backup } | { ok: false, errors: string[] }`. It rejects wrong `app`/`kind`/`version`, missing fields and non-numeric band values with plain messages. No device writes use it yet; it exists so the file format is pinned by tests.
3. Tests: round trip, slot order, each rejection case.
4. Workspace: in the "Slot names" action group (rename its heading to "Backup"), add `Export all slots (.json)`. Disabled until every user slot has been read. File name `ozybridge-<product>-slots-<YYYY-MM-DD>.json`. Uses the existing `download` helper. Keep the two slot-name buttons as they are.

Out of scope:
- Importing the backup back onto the device.
- Any change to slot-name storage or the preset library.

Done when:
- npm test and npm run typecheck pass
- The button downloads a file that `parseSlotBackup` accepts.

Commit on the branch above. Do not push.
Reply with: files changed, test results, open issues. No explanations.
```
