Read @AGENTS.md first.

Task: Add Ozy, a rect-based pixel-art wanderer that idles along the bottom of the page behind all content, animated with CSS only.
Phase: 8 (visual refresh), task 8d. Spec: `docs/design/phase-8-spec.md` section 4 (and the mascot rows in 5).

Files you may change:
- src/ui/mascotFrames.ts (new), src/ui/mascotFrames.test.ts (new)
- src/ui/Mascot.tsx (new), src/ui/mascot.css (new)
- src/App.tsx (mount only)

Files to read for context (nothing else):
- docs/design/phase-8-spec.md, src/App.tsx, src/ui/tokens.css

Anchor frame (walk 1, facing right). `.` transparent, 1 linen, 2 linen shadow, 3 outline, 4 hood void, 5 glint. Copy it exactly:

```
"....................33..",
"...........333......3.3.",
".........3311133....3...",
"........321111113...3...",
".......321111111133.1...",
".......32111144444432...",
".......321114445543.3...",
".......32211444433..3...",
".......322211143....3...",
"......32221111113...3...",
".....32221111111333.3...",
".....3222111111111133...",
".....3222211112221133...",
".....32211221122223.3...",
".....3221111111133..3...",
"....3221111111113...3...",
"....3221111111113...3...",
"....32211111111113..3...",
"....322111111111113.3...",
"...322111111111111133...",
"...3232132112311323.3...",
"....3.3332233223.3..3...",
".......3223..3223...3...",
"........33....33........",
```

Requirements:
1. `mascotFrames.ts` exports `FRAMES: Record<FrameName, string[]>` with `walk1` (the anchor), `walk2`, `walk3`, `walk4`, `sit`, `tea1` (cup at chest), `tea2` (cup at hood), `gaze1`, `gaze2` (hem flutter). Derive each from the anchor by moving as few pixels as possible: walk frames shift legs, hem and staff; sit lowers the body with the cloak pooled; tea frames add a 2x2 cup in colour 2/3. Keep the hood, glint and silhouette recognisable.
2. Also export `toRuns(frame)` that merges horizontal runs of one colour into `{ x, y, w, c }`. Tests: every frame is 24 rows of 24 chars from `.12345`; at most 5 colours; walk2-4 each differ from walk1 in at most 40 pixels; `toRuns` round-trips a frame.
3. `Mascot.tsx`: one `<svg viewBox="0 0 24 24" width="72" height="72" shape-rendering="crispEdges" aria-hidden="true" focusable="false">` holding one `<g>` per frame (rects only, `fill` from `var(--oz-mascot-1..5)`) and a 3-pixel steam group. Wrapper `div.mascot` with `pointer-events: none`.
4. `mascot.css`: palette tokens `--oz-mascot-1..5` on `:root` (linen `#D8C3A0`, shadow `#9C7F5C`, outline `#3B2A1E`, void `#16110D`, glint `var(--oz-accent)`) and `:root[data-theme='dark']` (outline `#9C7F5C`). `.mascot` is `position: fixed; bottom: 8px; z-index: -1`. One 64 s timeline (`steps()` for frame swaps, linear for travel): walk right from 2vw to about 88vw with a 4-frame cycle, turn, sit, tea break with rising steam, stand, walk back facing left (`scaleX(-1)`), gaze with hem flutter. No JS timers.
5. Under `prefers-reduced-motion: reduce` or `:root[data-motion='off']`: show `walk1` only, parked at the right, no travel.
6. Hidden during file drags: `body:has(.is-dragging) .mascot { visibility: hidden; }`.
7. So he never sits behind readable text: give `h1, .message, .label, .hint, .section-title, .supported-devices, .site-footer` a solid `background: var(--oz-bg)` and `position: relative`, and give `.app` `padding-bottom: 96px`. Put these rules in `mascot.css`.
8. `App.tsx`: import `./ui/mascot.css` and render `<Mascot />` on the connect screen and the workspace screen only (not `?bench`, `?probe`, or the unsupported message).

Out of scope:
- tokens.css, App.css, Footer.tsx, theme or motion toggles (other tasks set `data-theme` / `data-motion`; just read them).
- Any JS-driven animation, images, new dependencies.

Done when:
- npm test and npm run typecheck pass.
- `rg -n 'setInterval|setTimeout|requestAnimationFrame' src/ui/Mascot.tsx` is empty.

Reply with: files changed, test results, open issues. No explanations.
