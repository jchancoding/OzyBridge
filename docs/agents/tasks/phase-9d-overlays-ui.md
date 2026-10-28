# Phase 9d: measurement and target overlays in the EQ editor

```
Read @AGENTS.md first. Work only in /Users/jasper/Documents/GitHub/OzyBridge-9d (a git worktree). Do not commit.

Task: Let users overlay an IEM measurement (live from squiglink, or an uploaded file) and toggleable target curves on the EQ graph, in both the device workspace and OzyEQ, and make graph handles easier to grab on touch screens.
Phase: 9

Files you may change:
- src/ui/squiglink.ts, src/ui/MeasurementPicker.tsx, src/ui/measurementPicker.test.tsx (already ported from an older branch; adapt as needed)
- src/ui/TargetToggles.tsx (new), src/ui/targetToggles.test.tsx (new)
- src/ui/EqEditor.tsx (only to hold overlay state, render the overlay panel, and pass props to EqGraph)
- src/ui/EqGraph.tsx
- src/ui/tokens.css, src/ui/contrast.test.ts
- src/App.css (append one block at the very end, headed `/* Phase 9d: overlays */`)
- docs/design/STYLEGUIDE.md (colour tables only)

Files to read for context (nothing else):
- src/core/measurement.ts, src/core/targets.ts, src/core/squiglink.ts (do not change them)
- docs/design/STYLEGUIDE.md

Requirements:
1. squiglink.ts and MeasurementPicker.tsx: keep the ported behaviour (nothing fetched until "Compare with an IEM" is clicked; reviewer select; model search with at most 50 matches; upload `.txt,.csv`; Clear; credit "<brand> <name> <variant> measured by <reviewer>" linking to the database; hint "Approximation: a different unit and rig than yours."; plain inline error, no retry). Fix anything that no longer compiles.
2. TargetToggles.tsx: a row labelled "TARGETS" with one toggle button per `TARGETS` entry (`className="btn-secondary"`, `aria-pressed`). Several can be on at once. On first enable, fetch `targetUrl(import.meta.env.BASE_URL, t)` (same-origin static file; `credentials: 'omit'`), parse with parseMeasurement, cache per id in a module-level Map for the session. Failure shows "Could not load the <name> target." inline and leaves the toggle off. Calls `onChange(list: { id: string; name: string; measurement: Measurement }[])` in TARGETS order.
3. EqEditor: holds `measurement` (from MeasurementPicker) and `targets` (from TargetToggles) state; it persists across profile and resetKey changes. Render a `<section className="overlays">` with label "OVERLAYS" right after GraphKeysLegend containing MeasurementPicker and TargetToggles. Pass both to EqGraph.
4. EqGraph props: `measurement?: { label: string; measurement: Measurement }`, `targets?: { id: string; name: string; measurement: Measurement }[]`. Main graph only (ignored for thumb). On the same frequency grid as the main curve:
   - original = `equalizedResponse(...).original`, class `graph-fr-original`
   - equalized = `equalizedResponse(...).equalized`, class `graph-fr-eq`
   - each target = `targetCurve(...)`, class `graph-target`, with a per-index stroke-dasharray from ['2 4', '8 4', '12 4 2 4', '1 3']
   All drawn under the EQ curve and band handles, `pointerEvents="none"`, clipped to the plot like the compare curve. These curves must never affect hit-testing, dragging or adding bands.
5. Legend: when any overlay is drawn, list each drawn curve: the EQ label, "Original" and "Equalized" (when a measurement is set), each target name, and the compare label when compare is set. One legend group, no overlap with the existing compare legend (replace it with the combined legend when overlays are present). Names longer than 18 characters are truncated with "…" as today.
6. Y range: the auto range used by non-editable graphs includes overlay curves. Editable graphs keep the user's view; when overlays first appear, if the drawn overlay curves fall outside the current view, widen the default view once to fit them (round up to the existing tick steps). The aria-label mentions the measurement label and target names.
7. Touch: when `matchMedia('(pointer: coarse)').matches`, handle hit radius is at least 22 px and the drawn handle 1.5× its size. Guard for environments without matchMedia.
8. Tokens: add `--oz-fr-original` (light `#6B7785`, dark `#8C98A6`) and `--oz-target` (light `#7A3FB8`, dark `#D9A6FF`) to tokens.css for both themes, and add both to the graph-curve contrast pairs in contrast.test.ts. CSS: `.graph-fr-original` 2 px `--oz-fr-original`; `.graph-fr-eq` 3 px `--oz-text`; `.graph-target` 1.5 px `--oz-target`, no fill. Port the `.fr-*` picker rules from the old branch (`git show phase-9-fr-overlay:src/App.css`, the `.fr-` lines), plus `.overlays` spacing with tokens. Also add both tokens to the colour tables in docs/design/STYLEGUIDE.md.
9. Tests: keep the ported picker tests passing. targetToggles.test.tsx: renders a toggle per target with aria-pressed="false" and fetches nothing on render; the loader (export it, e.g. `loadTarget(t)`) calls fetch once with the encoded URL and returns cached data the second time; a failed fetch rejects.

Out of scope:
- OzyEq.tsx, App.tsx, Workspace.tsx, src/core, src/devices, src/transport. Saving overlays to storage. Auto-EQ to a target. No new dependencies.

Done when:
- npm test, npm run typecheck and npm run build pass

Reply with: files changed, test results, open issues. No explanations.
```
