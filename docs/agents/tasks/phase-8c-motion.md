Read @AGENTS.md first.

Task: Add the hover glints, the boot stagger on connect, and a one-shot scan sweep across the graph after a verified write.
Phase: 8 (visual refresh), task 8c. Spec: `docs/design/phase-8-spec.md` section 5 (hover, boot, scan rows).

Files you may change:
- src/ui/motion.css (new)
- src/ui/Workspace.tsx
- src/ui/EqGraph.tsx

Files to read for context (nothing else):
- docs/design/phase-8-spec.md, src/ui/tokens.css, src/App.css (read only, for existing `.slot` and `.btn-primary` rules), and the files above

Requirements:
1. `motion.css`, imported from `Workspace.tsx`. All durations and easing from tokens.
2. Slot glint: `.slot::after` is a 45 degree light band (`--oz-surface` at about 60% to transparent) that sweeps across once on `:hover` and `:focus-within`, `--oz-slow`, `pointer-events: none`. The top-left chamfer edge turns `--oz-accent` on the same triggers (a `::before` corner line). Must not hide the drop outline or the active / selected / compare markers.
3. Primary button glint: same sweep once on hover for `.btn-primary` (add `position: relative; overflow: hidden` in `motion.css`).
4. Boot stagger: the HUD and each slot card fade in and slide 8 px on mount, slot delay `calc(var(--i) * 30ms)`, total under 600 ms. `Workspace.tsx` sets `style={{ '--i': index }}` on slot cards (typed, no `any`).
5. Scan sweep: `EqGraph` gets an optional `sweep?: number` prop. When above 0 it renders, keyed by `sweep`, a 2 px `--oz-accent` line with a short trailing wash clipped to the plot area, crossing left to right once in 600 ms. Thumbnails never render it. `Workspace.tsx` bumps a counter only after a write is verified (both save and undo restore) and passes it to the main graph.
6. `prefers-reduced-motion: reduce`: no glint, no sweep, no slide or stagger delay; the chamfer edge colour change stays.

Out of scope:
- tokens.css, App.css, theme, glass, background, mascot.
- Any change to write, verify or notice logic beyond bumping the counter.
- Anything under src/core/, src/devices/, src/transport/.

Done when:
- npm test and npm run typecheck pass.
- `git diff main -- src/ui/Workspace.tsx` touches only the `--i` style, the counter and the `sweep` prop.

Reply with: files changed, test results, open issues. No explanations.
