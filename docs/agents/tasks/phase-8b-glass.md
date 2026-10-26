Read @AGENTS.md first.

Task: Make the sticky chrome glass over a faint animated perspective-grid background, and add the Motion toggle that stops ambient motion.
Phase: 8 (visual refresh), task 8b. Spec: `docs/design/phase-8-spec.md` sections 1b (glass tokens), 2 (glass pairs), 3 (glass row) and 5 (ambient rows, Motion toggle).

Files you may change:
- src/App.css
- src/ui/tokens.css (only if a background token is needed)
- index.html
- src/ui/prefs.ts, src/ui/prefs.test.ts
- src/ui/Footer.tsx
- src/ui/contrast.test.ts (only to add background pairs)
- docs/design/STYLEGUIDE.md

Files to read for context (nothing else):
- docs/design/phase-8-spec.md, docs/design/STYLEGUIDE.md, src/ui/mascot.css, and the files above

Requirements:
1. Glass: `.sticky` gets `background: var(--oz-glass)` and `backdrop-filter: blur(var(--oz-blur)) saturate(1.2)`. `.hud`, `.notice-ok`, `.notice-info`, `.notice-busy` inside it use `--oz-glass` with no second blur. `.notice-error` and `.notice-confirm` keep their solid washes. Slot cards, band table, graph, inputs, buttons stay solid.
2. Fallbacks to solid `--oz-surface` / `--oz-bg`: `@supports not (backdrop-filter: blur(1px))`, `@media (prefers-reduced-transparency: reduce)`, `@media (prefers-contrast: more)` (which also sets chrome borders to `--oz-line-strong`).
3. Background: a fixed `body::before` at `z-index: -2` drawing a WipeOut-style perspective grid (thin `--oz-line` lines, faded toward a horizon near the vertical middle, lines at most 35% opacity). It drifts toward the viewer on an 8 s linear loop. Dark adds `body::after` scanlines (2 px period, at most 3% white) drifting slowly. Both `pointer-events: none`. Solid-background text rows from `mascot.css` may cut the grid; that is expected.
4. Ambient motion off: `prefers-reduced-motion: reduce` or `:root[data-motion='off']` stops the grid and scanlines (static).
5. `prefs.ts`: `MOTION_KEY = 'ozy-motion'`, pure `parseMotionPref(raw, prefersReduced)` returning `'on' | 'off'` (default on unless reduced), and a `useMotionPref()` hook that stores it and sets `data-motion`. Tests for the pure function. `index.html`'s inline script also sets `data-motion` before paint.
6. `Footer.tsx`: a `MOTION` group next to `THEME` with `ON` / `OFF`, same pattern (`role="group"`, `aria-pressed`).
7. `contrast.test.ts`: add `--oz-text-3` on `--oz-bg` composited with `--oz-line` at the grid opacity, both themes, 4.5:1.
8. `STYLEGUIDE.md`: replace "No glassmorphism, neon glow, or heavy blur" with the glass-on-chrome rule (blur `--oz-blur`, no glow, never behind data); add short Background and Mascot sections from the spec; note the Motion toggle under Motion.

Out of scope:
- Hover effects, boot stagger, scan sweep (task 8c, `src/ui/motion.css`), mascot files, theme tokens.
- Anything under src/core/, src/devices/, src/transport/.

Done when:
- npm test and npm run typecheck pass.
- No new hard-coded colours in App.css except the scanline white alpha.

Reply with: files changed, test results, open issues. No explanations.
