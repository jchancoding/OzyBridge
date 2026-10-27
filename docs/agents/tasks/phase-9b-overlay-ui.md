# Phase 9b: frequency response overlay UI

```
Read @AGENTS.md first (note the squiglink network rule).

Task: Let users pick an IEM measurement (squiglink or uploaded file) and see its original and equalized response on the slot graph.
Phase: 9 (docs/ROADMAP.md)

Files you may change:
- src/ui/squiglink.ts (new, the only file that fetches squiglink)
- src/ui/MeasurementPicker.tsx (new)
- src/ui/EqGraph.tsx
- src/ui/Workspace.tsx (only the `eq-view` section near `<EqGraph profile={shown}` and the state it needs)
- src/App.css
- src/ui/tokens.css
- src/ui/contrast.test.ts
- src/ui/measurementPicker.test.tsx (new)

Files to read for context (nothing else):
- src/core/measurement.ts, src/core/squiglink.ts (APIs from 9a; do not change them)
- docs/design/STYLEGUIDE.md
- src/ui/eqGraphScale.test.tsx (test style)

Requirements:
1. src/ui/squiglink.ts: `loadDbs()`, `loadModels(db)`, `loadMeasurement(db, file)`. Plain `fetch` GET, no query strings, no credentials (`credentials: 'omit'`), 15 s timeout via AbortController. Results cached in a module-level Map for the session (no localStorage). loadMeasurement fetches L and R; if one fails, use the other; if both fail, throw. Uses parseSquigSites, parsePhoneBook, measurementUrls, parseMeasurement, averageChannels from src/core.
2. Nothing is fetched until the user opens the picker (clicks "Compare with an IEM"). No fetch on page load.
3. MeasurementPicker: a "Compare with an IEM" button that expands to: reviewer `<select>` (format "Reviewer (type)", default the first IEMs db), a model search `<input>` with a filtered list (show at most 50 matches; variants appear as separate options), and an "Upload measurement" button (file input, accept .txt,.csv). A "Clear" button removes the overlay.
4. When a squiglink model is selected, show "<brand> <name> <variant> measured by <reviewer>" with the reviewer name linking to the db baseUrl (target=_blank, rel=noopener). For uploads, show "<file name> (your file)". Under it, in hint text: "Approximation: a different unit and rig than yours."
5. Errors (network, CORS, parse) show a plain inline message ("Could not load this measurement from <reviewer>." or the parser's message). The graph keeps the previous state. No automatic retry.
6. Picker calls `onChange(m: { label: string; measurement: Measurement } | null)`. Workspace keeps that in state across slot changes and passes it to EqGraph.
7. EqGraph gains an optional prop `measurement?: { label: string; measurement: Measurement }`. When set (main graph only, not thumb): compute `equalizedResponse` on the 260-point grid; draw original (new class `graph-fr-original`) and equalized (`graph-fr-eq`) curves, keep the EQ curve, and show a legend with "Original", "Equalized", "EQ". graphDbRange includes all drawn curves. aria-label mentions the measurement label. If `compare` is also set, show the compare curve too.
8. Add tokens `--oz-fr-original` and `--oz-fr-eq` for light and dark themes in tokens.css, and add them to the graph-curve pairs in contrast.test.ts for both themes. Original is muted; equalized is strong and distinct from `--oz-curve` and `--oz-curve-2`.
9. measurementPicker.test.tsx: mock `fetch`; check that nothing is fetched before the button is clicked, that the credit text renders "measured by <reviewer>", that an upload of a small REW text calls onChange, and that a failed fetch shows the error message.

Out of scope:
- Target curves, autoEQ, saving measurements, anything in src/core, src/devices or src/transport. No new dependencies.

Done when:
- npm test, npm run typecheck and npm run build pass
- Selecting a model or uploading a file draws original + equalized curves on the slot graph

Reply with: files changed, test results, open issues. No explanations.
```
