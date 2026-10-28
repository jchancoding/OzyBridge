# Phase 9c: OzyEQ page and landing changes

```
Read @AGENTS.md first. Work only in /Users/jasper/Documents/GitHub/OzyBridge-9c (a git worktree). Do not commit.

Task: Add OzyEQ, a no-device EQ editor at `?eq`, and make the landing page useful on browsers without WebHID (phones, tablets, Firefox, Safari).
Phase: 9

Files you may change:
- src/App.tsx
- src/ui/OzyEq.tsx (new)
- src/ui/ozyEq.test.tsx (new)
- src/App.css (append one block at the very end, headed `/* Phase 9c: OzyEQ and landing */`; do not edit existing rules except `.landing-bar` justify-content)

Files to read for context (nothing else):
- src/ui/EqEditor.tsx, src/ui/useEqDraft.ts, src/ui/download.ts, src/ui/Workspace.tsx (notice markup, import/paste/drag handling, copyShare; reuse the patterns, do not change the file)
- src/core/freeLimits.ts, src/core/fit.ts, src/core/autoeq.ts, src/core/fiioXml.ts, src/core/shareLink.ts, src/core/eq.ts
- src/devices/fiio/models.ts and src/devices/walkplay/models.ts (exports FIIO_MODELS, WALKPLAY_MODELS only)
- docs/design/STYLEGUIDE.md

Requirements:
App.tsx
1. Read query params before the WebHID check. `?eq` renders `<OzyEq />` and `?feedback` renders `<Feedback />` on every browser. `?bench`, `?probe`, `?verify` keep the existing one-line unsupported message when WebHID is missing.
2. Without WebHID, the landing page still renders (header, intro, supported devices, footer, mascot). The CONNECT button is not rendered; under the header show `<p className="message">` with exactly: "This browser can't connect to USB DACs. To read and write device EQ, open OzyBridge in Chrome or Edge on a computer. You can still build and export EQs in OzyEQ." The verify call-to-action section is hidden without WebHID.
3. Header: brand, then the primary button labelled `CONNECT DAC` (only with WebHID), then a secondary link-button `OZYEQ` (`<a className="btn-secondary" href="?eq">`). All left-aligned in one row on desktop (`.landing-bar` uses `justify-content: flex-start`), wrapping on narrow screens.
4. After the intro section add a short section: heading link "Try OzyEQ: build an EQ without a device →" (href `?eq`) and one sentence: "Shape a parametric EQ on any phone, tablet or computer, then download it as a Squiglink / AutoEQ .txt file for any EQ app, or send it to your DAC here later."
5. Shared links (`#eq=`): with WebHID keep today's message and append " Or open it in OzyEQ." as a link to `?eq` + the same hash. Without WebHID show "This link is the EQ “<name>”." followed by a link "Open it in OzyEQ" (`?eq` + hash).

OzyEq.tsx
6. Layout: `<main className="app screen">`, a `.landing-bar` header with Stripes, `<h1 className="display">OzyEQ</h1>`, and a secondary link "OzyBridge" (href `./`). Then notice area, device select, name field, import section, the EqEditor, export section, Footer. Render `<Mascot />` after main like App does.
7. Device select (label "Device limits"): first option "No device (10 bands)" using FREE_LIMITS, then every FIIO_MODELS and WALKPLAY_MODELS entry by name, sorted case-insensitively, using `capabilities` as limits (DeviceCapabilities extends EqLimits). On change run fitProfile(current shown profile, new limits). If ok: the fitted profile becomes the new base, history is cleared, ok notice "Now using <name> limits." plus fit notes. If not ok: keep the previous selection and show an error notice "This EQ doesn't fit the <name>: " plus the fit error messages. Hint under the select: "Pick your DAC to keep the EQ within what it can store."
8. Name input (label "EQ name", default "OzyEQ"), used for the download file name and share link name. Imports set it from the parsed name or the file name without extension.
9. Editing: `useEqDraft(base)`, where `base` starts as `emptyProfile(limits)`. EqEditor heading "EQ", label = name, resetKey bumps on import, device change, reset. Children: Undo, Redo, and "Reset to flat" (applies `emptyProfile(limits)` as an edit so Undo restores it).
10. Import section (label "Import"): "Choose file (.txt / .xml)" (file input accept `.txt,.xml`), "Paste from clipboard" (navigator.clipboard.readText), and a `<textarea>` labelled "Or paste EQ text here" with a "Load" button. Window-level paste (not inside input/select/textarea) and file drop anywhere on the page also import. Parse with parseFiioXml for `.xml` or text starting with `<`, otherwise parseAutoEq; then fitProfile against current limits. Errors show as one error notice. Success: fitted profile becomes base, history cleared, ok notice "Loaded “<name>”." plus notes; fit warnings (clipping) show as a warn notice instead.
11. Export section (label "Export"): "Download .txt (Squiglink / AutoEQ)" → download(`<name>.txt`, exportAutoEq(shown, { omitFlat: true }), 'text/plain'); "Copy as text" → clipboard; "Copy share link" → `${location.origin}${location.pathname}#${encodeShareFragment({ name, profile: shown })}` (no `?eq`, so a desktop Chrome user lands on the device flow). Clipboard failure shows "The browser blocked clipboard access. Allow it and try again."
12. On mount, if location.hash starts with `#eq=`, decode it, fit to current limits, load it like an import, then `history.replaceState` without the hash.
13. Persist `{ v: 1, device: string, name: string, profile: EqProfile }` to localStorage `ozy-eq-draft` whenever shown, name or device changes. Restore on mount (before the share link step) only if it parses and fitProfile against that device's limits is ok; otherwise start flat with no device. Unknown device names fall back to no device.
14. Notices use the same markup and classes as Workspace (`notice notice-<kind>`, role alert for error/warn, Dismiss button for error/warn, ok/info auto-hide after 4 s).

CSS (appended block)
15. `.landing-bar { justify-content: flex-start; }` (edit the existing rule). OzyEQ form rows use existing `.bar`, `.label`, `.hint` classes. Textarea: full width, mono font, 6 rows, tokens only.
16. `@media (max-width: 600px)`: hide `.bands .step` (gain nudge buttons), make `.bar > .btn-primary, .bar > .btn-secondary` full width, and let `.landing-bar` wrap with the buttons on their own row. `@media (pointer: coarse)`: hide `.graph-keys`.

Tests (ozyEq.test.tsx, `renderToStaticMarkup` from react-dom/server, stub `localStorage` and `location` with vi.stubGlobal as needed)
17. OzyEq renders the "OzyEQ" heading, "No device (10 bands)", "Download .txt (Squiglink / AutoEQ)" and "Or paste EQ text here". App without `navigator.hid` and no query renders "This browser can't connect to USB DACs" and no "CONNECT DAC"; with a stub `navigator.hid` it renders "CONNECT DAC" and "OZYEQ".

Out of scope:
- EqEditor, EqGraph, overlays, Workspace, src/core, src/devices, src/transport. Preset library. No new dependencies.

Done when:
- npm test, npm run typecheck and npm run build pass

Reply with: files changed, test results, open issues. No explanations.
```
