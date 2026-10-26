```
Read @AGENTS.md first.

Task: Compare: a slot card button overlays that slot's curve on the main graph in --oz-curve-2.
Phase: 7a
Branch: feat/7a-compare

Files you may change:
- src/ui/EqGraph.tsx
- src/ui/Workspace.tsx
- src/App.css

Files to read for context (nothing else):
- src/ui/tokens.css
- src/core/response.ts
- docs/design/STYLEGUIDE.md

Requirements:
1. `EqGraph` gets optional `compare?: { profile: EqProfile; label: string }` (full-size graph only; ignored for `thumb`). It draws a second path with class `graph-curve-2` under the main curve, and a small two-entry legend inside the plot's top-right (main label, compare label). The aria-label mentions the comparison.
2. `.graph-curve-2` in `src/App.css` uses `var(--oz-curve-2)`, same stroke width as `.graph-curve`, dashed, no fill. Use tokens only; no new hex values.
3. Workspace: each slot card gets a `Compare` toggle button next to `Activate` (aria-pressed). Pressing it sets that slot as the compare slot; pressing again clears it. Disabled for the selected slot and for slots not yet read. Clicks do not select the card (stopPropagation).
4. The main graph receives the compare slot's saved profile; label is the slot name or `Slot NN`. Selecting the compare slot itself clears the comparison.
5. The compare card shows a visible state (outline or badge using `--oz-curve-2`).

Out of scope:
- Comparing against files or presets, more than one overlay, src/core changes.

Done when:
- npm test and npm run typecheck pass
- With two read slots, Compare on the second shows both curves on the first slot's graph.

Commit on the branch above. Do not push.
Reply with: files changed, test results, open issues. No explanations.
```
