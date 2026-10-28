# Phase 9a: extract the EQ editor from Workspace

```
Read @AGENTS.md first. Work only in /Users/jasper/Documents/GitHub/OzyBridge-9a (a git worktree). Do not commit.

Task: Move the slot EQ editor out of src/ui/Workspace.tsx into reusable pieces, with no visible or behavioural change, so a second page (OzyEQ, no device) can reuse it.
Phase: 9

Files you may change:
- src/ui/Workspace.tsx
- src/ui/NumField.tsx (new)
- src/ui/useEqDraft.ts (new)
- src/ui/EqEditor.tsx (new)
- src/ui/download.ts (new)

Files to read for context (nothing else):
- src/ui/Workspace.tsx, src/ui/EqGraph.tsx (props only, lines 340-370), src/core/history.ts, src/core/graphEdit.ts, src/core/eq.ts

Requirements:
1. src/ui/NumField.tsx: move `NumField` unchanged and export it.
2. src/ui/download.ts: move `download(name, text, type)` unchanged and export it.
3. src/ui/useEqDraft.ts: a hook `useEqDraft(base: EqProfile | undefined)` holding the draft history now in Workspace (editHist, dragHistSkip, clearEdit, applyEdit, beginDragEdit, endDragEdit, undoEdit, redoEdit). Returns `{ draft, shown, canUndo, canRedo, clear, apply, beginDrag, endDrag, undo, redo }` where `shown = draft ?? base`. Same logic and same history functions as today.
4. src/ui/EqEditor.tsx: a component that renders today's `<section className="eq-view">` contents: EqGraph (editable), GraphKeysLegend, the sr-only live text, preamp row with hint, clip warning with "Set preamp" button, band table, "+ Add band" footer. Props:
   - `heading: ReactNode` (rendered as the existing h2.section-title content)
   - `profile: EqProfile` (the shown profile), `limits: EqLimits`, `resetKey: string`
   - `label: string`, `compare?: { profile: EqProfile; label: string }`, `sweep?: number`
   - `onChange(next: EqProfile, opts?: { coalesceKey?: string; skipPush?: boolean }): void`
   - `onEditStart(): void`, `onEditEnd(): void`, `onUndo(): void`, `onRedo(): void`
   - `onNotice(text: string): void` (error text), `onBlockedChange(blocked: boolean): void`
   - `children?: ReactNode` rendered last inside the section (Workspace passes its Save/Undo/Redo/Discard bar).
   EqEditor owns `selectedBand` (reset to null when `resetKey` changes) and the `blocked` map (cleared when `resetKey` changes; reports `Object.values(blocked).some(Boolean)` through onBlockedChange whenever it changes). It owns the Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, Cmd/Ctrl+Y listener scoped to its section, calling onUndo/onRedo (same rules as today). `clipCheck`, `addBandAt`, `deleteBand`, `firstUnused`, `usedCount`, `isUnused`, gain nudge and add-band logic move with it, using `limits` where Workspace used `cap`.
5. Workspace keeps all device logic (slots, writes, restore, presets, notices, shared links) and the Save changes / Undo / Redo / Discard bar, now passed as EqEditor children. `anyBlocked` comes from onBlockedChange. Discard still bumps undoCount so resetKey changes. Clicking a slot no longer needs `setBlocked({})` since resetKey changes with the slot.
6. Same DOM structure, class names, text, titles and aria attributes as today. `Stripes` stays exported from Workspace.tsx (App.tsx imports it).

Out of scope:
- Any visual or behaviour change, CSS, src/core, src/devices, src/transport. No new dependencies. No new features.

Done when:
- npm test, npm run typecheck and npm run build pass
- Workspace.tsx no longer defines NumField, download, or the band table, and is at least 250 lines shorter

Reply with: files changed, test results, open issues. No explanations.
```
