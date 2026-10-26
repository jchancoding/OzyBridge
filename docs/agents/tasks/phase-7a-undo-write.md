```
Read @AGENTS.md first.

Task: Add "Undo last write": remember the slot's profile from before the most recent write and restore it in one click.
Phase: 7a
Branch: feat/7a-undo-write

Files you may change:
- src/ui/Workspace.tsx

Files to read for context (nothing else):
- src/core/eq.ts
- src/core/slotNames.ts
- src/devices/types.ts
- docs/design/STYLEGUIDE.md

Requirements:
1. Before `writeProfile` writes, capture `{ id, profile: profiles[id], name: slotName(id) }` if `profiles[id]` is known. After the write is verified, keep it as the single "last write" entry (in memory only, one level, newest replaces older).
2. The success notice after a write gets an `Undo` button. The entry also shows as `Undo last write (slot NN)` in the Import action group until used or replaced. Both disabled while busy.
3. Undo writes the saved profile back through the same `writeProfile` path (verified read-back, slot name restored), with no overwrite confirm. After a successful undo the entry is cleared; undo is not itself undoable.
4. If the previous profile was never read, no undo entry is created.
5. A failed write does not create or replace the entry.
6. Keep the existing "Undo changes" (discard draft) button and rename nothing else.

Out of scope:
- Multi-level history, persistence across reloads, src/core changes.

Done when:
- npm test and npm run typecheck pass
- Manual reasoning check: write slot A, then undo, leaves slot A's bands and name as before the write.

Commit on the branch above. Do not push.
Reply with: files changed, test results, open issues. No explanations.
```
