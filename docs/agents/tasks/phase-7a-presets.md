```
Read @AGENTS.md first.

Task: Preset library: named EQs kept in browser storage; save from a slot, drop onto a slot, rename, delete, JSON backup.
Phase: 7a
Branch: feat/7a-presets

Files you may change:
- src/core/presets.ts (new)
- src/core/presets.test.ts (new)
- src/ui/PresetLibrary.tsx (new)
- src/ui/Workspace.tsx
- src/App.css

Files to read for context (nothing else):
- src/core/eq.ts
- src/core/fit.ts
- src/core/slotNames.ts (storage and JSON style to copy)
- src/ui/EqGraph.tsx
- docs/design/STYLEGUIDE.md

Requirements:
1. `src/core/presets.ts` is pure (no localStorage): type `Preset = { id, name, profile: EqProfile, createdAt, source?: string }`; `addPreset`, `renamePreset`, `deletePreset` (immutable, return a new list), `serializePresets`, `parsePresets(text | null)` (bad or missing input gives `[]`; invalid entries are dropped, valid ones kept). IDs come from a caller-supplied function so tests are deterministic. Presets are device-independent.
2. Tests for every function, including dropping malformed entries and keeping order.
3. `PresetLibrary.tsx` lists presets as cards (name field, thumbnail via `EqGraph thumb`, band count and preamp caption, Delete with an inline confirm). Cards are draggable with dataTransfer type `application/x-ozybridge-preset` carrying the id. Buttons: `Save slot NN as preset`, `Back up presets (.json)`, `Load presets from file` (merges by id, file wins).
4. Storage key `ozy-presets`, read and written in Workspace the same way as `ozy-slot-names`.
5. Workspace: slot `onDrop` checks for the preset type before files. Dropping a preset runs it through `fitProfile` with the device capabilities, then `requestWrite` (normal overwrite confirm, read-back, slot name set to the preset name). Fit errors show as an error notice. Each preset card also has `Write to slot NN` for keyboard users.
6. Library section sits below the action groups, titled "Preset library", empty state text explains how to save one.

Out of scope:
- Cloud sync, sharing, folders, tags, search, editing bands inside the library.

Done when:
- npm test and npm run typecheck pass
- Save a slot as a preset, reload, the preset is still there; dragging it onto another slot writes and verifies it.

Commit on the branch above. Do not push.
Reply with: files changed, test results, open issues. No explanations.
```
