# Phase 8 spec: Mirage

Direction chosen 2026-10-27: **Mirage**. The WipeOut / Ridge Racer race HUD at desert noon, with desert night as the dark theme. Light stays the primary theme. Data (graph, numbers) stays the hero; the new layer lives in the chrome, the background and the mascot.

Ozy is short for Ozymandias: "the lone and level sands stretch far away". The mascot is that wanderer.

## 1. Tokens

`src/ui/tokens.css` stays the single source. Theme is set on `<html data-theme="light|dark">` before first paint. `STYLEGUIDE.md` gets the same tables.

### 1a. Light theme fixes (current values fail WCAG AA)

| Token | Now | New | Why |
|---|---|---|---|
| `--oz-accent` | `#00A6E0` | `#0086BD` | Curve and focus ring were 2.79:1 on white; now 4.08:1 |
| `--oz-text-3` | `#7D8794` | `#5F6975` | Labels were 3.64:1 on bg; now 5.15:1, 4.74:1 on `--oz-surface-2` |
| `--oz-drop` | `#F57C00` | `#C25E00` | Drop outline was 2.70:1; now 4.29:1 on white, 3.83:1 on drop wash |
| `--oz-ok` | `#14B87A` | `#0B7F55` | White "ON" on the switch was 2.57:1; now 5.02:1 |
| `--oz-danger` | `#E5254B` | `#D61F45` | White on danger button was 4.47:1; now 5.07:1 |
| `--oz-warn` | `#FFB800` | `#A87400` | Notice bar was 1.73:1; now 4.07:1 |

Primary button: fill `--oz-accent-strong`, label `--oz-on-accent`. Hover darkens (no lighten: it would drop below 4.5:1).

### 1b. New semantic tokens (replace every hard-coded colour in `src/App.css`)

| Token | Light | Dark | Replaces |
|---|---|---|---|
| `--oz-on-accent` | `#FFFFFF` | `#0E131A` | `#fff` on `.btn-primary` |
| `--oz-on-danger` | `#FFFFFF` | `#0E131A` | `#fff` on `.btn-danger` |
| `--oz-on-ok` | `#FFFFFF` | `#0E131A` | `#fff` in `.switch-on` |
| `--oz-danger-wash` | `#FFF1F4` | `#3A1620` | `.notice-error`, `.num-error` |
| `--oz-warn-wash` | `#FFF8E1` | `#3A3010` | `.notice-confirm` |
| `--oz-scrim` | `rgb(16 24 32 / 0.12)` | `rgb(0 0 0 / 0.45)` | `.drop-overlay` |
| `--oz-inverse` / `--oz-on-inverse` | `#101820` / `#FFFFFF` | `#E8EDF2` / `#101820` | `.drop-overlay span` |
| `--oz-glass` | `rgb(255 255 255 / 0.92)` | `rgb(22 29 38 / 0.92)` | new, chrome panels |
| `--oz-blur` | `10px` | `10px` | new |

### 1c. Dark theme: desert night

| Token | Value | Check (on `--oz-surface` unless noted) |
|---|---|---|
| `--oz-bg` | `#0E131A` | |
| `--oz-surface` | `#161D26` | |
| `--oz-surface-2` | `#1F2833` | |
| `--oz-line` | `#2E3A47` | grid only, decorative |
| `--oz-line-strong` | `#6B7888` | 3.77:1 (axis, borders) |
| `--oz-text` | `#E8EDF2` | 14.40:1 |
| `--oz-text-2` | `#A9B4C0` | 8.06:1, 7.08:1 on surface-2 |
| `--oz-text-3` | `#9AA6B4` | 6.86:1 |
| `--oz-accent` | `#22C3F5` | 8.23:1 (curve) |
| `--oz-accent-strong` | `#6BD6FF` | 10.25:1 (accent text) |
| `--oz-accent-wash` | `#0F2E3D` | text on it 12.06:1 |
| `--oz-signal` | `#FF7A45` | |
| `--oz-warn` | `#FFC633` | 10.81:1 |
| `--oz-danger` | `#FF5C7A` | 5.71:1 |
| `--oz-ok` | `#2FD49A` | 8.89:1 |
| `--oz-drop` | `#FF9A3D` | 8.03:1, 6.79:1 on drop wash |
| `--oz-drop-wash` | `#3A2610` | text on it 12.17:1 |
| `--oz-curve-2` | `#C77DFF` | 6.31:1 |

Primary button in dark: fill `--oz-accent`, label `--oz-on-accent` (9.05:1).

Theme resolution: stored choice `ozy-theme` in localStorage (`system` | `light` | `dark`, default `system`). `system` follows `prefers-color-scheme` and updates live. An inline script in `index.html` sets `data-theme` before paint so there is no flash. No cookies.

## 2. Contrast targets (both themes, every skin)

Enforced by a Vitest test that parses `tokens.css` and checks these pairs per theme:

- Text, 4.5:1: `--oz-text`, `--oz-text-2`, `--oz-text-3`, `--oz-accent-strong` on `--oz-bg`, `--oz-surface`, `--oz-surface-2` and `--oz-accent-wash`; `--oz-text` on `--oz-drop-wash`, `--oz-danger-wash`, `--oz-warn-wash`; each `--oz-on-*` on its fill; `--oz-on-inverse` on `--oz-inverse`; `--oz-danger` on `--oz-surface` and `--oz-danger-wash` (error text).
- Glass, 4.5:1: `--oz-text`, `--oz-text-2`, `--oz-text-3` on `--oz-glass` composited over `--oz-text` (worst case: dark content scrolling under the sticky bar in light, light content in dark). Measured at 0.92: light text-3 4.7:1, dark text-3 5.5:1. Accent and danger text never sit on glass (accent-strong only reaches 4.4:1 even at 0.95), so error and confirm notices keep their solid washes.
- Graphics, 3:1 (WCAG 1.4.11): `--oz-accent` (curve, focus ring), `--oz-curve-2`, `--oz-drop` (drop outline), `--oz-danger` (clip tint edge, errors), `--oz-ok`, `--oz-warn`, `--oz-line-strong` on `--oz-surface`; `--oz-drop` on `--oz-drop-wash`.
- Not colour alone: the comparison curve keeps its dash pattern (accent vs curve-2 is only 1.1-1.4:1 in luminance); drop targets keep the dashed/solid outline change and the text overlay.

## 3. Components affected

| Area | Change | Files |
|---|---|---|
| Tokens, theme | Dark set, fixes, semantic tokens, no-flash script, Theme toggle | `tokens.css`, `index.html`, `App.css`, `src/ui/prefs.ts`, `Footer.tsx`, `STYLEGUIDE.md` |
| Glass, background | Glass on `.sticky`, `.hud`, and `.notice-ok`, `.notice-info`, `.notice-busy` (error and confirm stay solid); perspective grid horizon on `body::before`; scanlines in dark; Motion toggle | `tokens.css`, `App.css`, `prefs.ts`, `Footer.tsx`, `index.html` |
| Motion, hover | Slot glint, chamfer corner, boot stagger, scan sweep | new `src/ui/motion.css`, `Workspace.tsx`, `EqGraph.tsx` |
| Mascot | Ozy sprite and wander layer | new `src/ui/Mascot.tsx`, `src/ui/mascotFrames.ts`, `src/ui/mascot.css`, `App.tsx` |
| Skins (optional) | Palette swaps via `data-skin` | `tokens.css`, `prefs.ts`, `Footer.tsx` |

Stays solid (no glass): slot cards, band table, EQ graph, inputs, buttons. Data never sits on blur.

Glass fallbacks, all to solid `--oz-surface`: `@supports not (backdrop-filter: blur(1px))`, `prefers-reduced-transparency: reduce`, `prefers-contrast: more` (also borders become `--oz-line-strong`).

## 4. Mascot: Ozy

- Brooding wanderer in ragged linen with an oversized hood, loosely after Marathon's Assassin: tall, slim, faceless. The hood is a dark void with a 2-pixel visor glint, the only accent pixel. Walking staff. Jagged, torn hem.
- 24 x 24 grid, one `<rect>` per pixel run, `shape-rendering="crispEdges"`, drawn at an integer scale (3x, 72 px). Frames are data (`mascotFrames.ts`: 24 strings of 24 chars per frame, `.` is transparent, digits index the palette). One anchor frame; every other frame is derived from it with as few pixel changes as possible.
- Palette, 5 colours, as CSS variables so themes and skins can retint: linen `#D8C3A0`, linen shadow `#9C7F5C`, outline `#3B2A1E` (light) / `#9C7F5C` (dark, 4.97:1 on bg so the silhouette survives), hood void `#16110D`, glint `--oz-accent`.
- Idle states on one CSS timeline of about 64 s, no JS timers: walk (4 frames), turn, sit, tea break (cup to hood, 3 steam pixels rising), stand, walk back, gaze at the horizon. The hem flutters during the gaze.
- Wanders without interfering: a `position: fixed` layer at the bottom of the viewport, `pointer-events: none`, `aria-hidden="true"`, stacked below all content (content panels cover him, he never covers them). He walks across the bottom strip and stops in the side gutters to sit and drink tea. Text that sits straight on the page background (`h1`, `.message`, `.label`, `.hint`, `.section-title`, `.supported-devices`, `.site-footer`) gets a solid `--oz-bg` background so he passes behind it like a panel (light text on his linen would be 1.3:1 in dark). `.app` gets enough bottom padding that the footer clears him at scroll end. Stacking: background layer `z-index: -2`, mascot `-1`, content above. Hidden while a file drag is active (`body:has(.is-dragging)`) and on `?bench` and `?probe`.
- Static standing frame under `prefers-reduced-motion` or Motion off.

## 5. Motion list

All durations from tokens; easing `--oz-ease`. Nothing bounces.

| Moment | Motion | Reduced motion / Motion off |
|---|---|---|
| Slot card hover and keyboard focus | One 45 degree light band sweeps across, `--oz-slow`; top-left chamfer edge turns `--oz-accent` | No sweep; the chamfer edge colour still changes |
| Primary button hover | Same glint, once | No glint; colour change only |
| Boot stagger on connect | HUD, then slots 01..N fade in and slide 8 px, 30 ms apart, under 600 ms total | Instant |
| Scan sweep after a verified write | 2 px `--oz-accent` line with a short trailing wash crosses the plot area once, 600 ms | None; the "saved and verified" notice is the signal |
| Background grid drift (ambient) | Perspective grid scrolls toward the viewer, 8 s loop; dark adds slow scanlines | Static grid |
| Mascot idle (ambient) | Section 4 timeline | Static frame |
| Theme change | Instant, no cross-fade | Same |
| Existing: speed stripes, screen slide | Unchanged | Unchanged (already handled) |

Ambient motion (anything over 5 s) needs a user control (WCAG 2.2.2). Footer gets `THEME [AUTO | LIGHT | DARK]` and `MOTION [ON | OFF]`. Motion is stored as `ozy-motion`, default on unless `prefers-reduced-motion`. It sets `<html data-motion="off">`.

## 6. Build tasks

One design dimension per task, one PR each. Specs go in `docs/agents/tasks/phase-8*.md`.

| Task | Branch | Runs |
|---|---|---|
| 8a dark tokens, light fixes, theme toggle, contrast test | `phase-8a-theme` | Wave 1 |
| 8d mascot | `phase-8d-mascot` | Wave 1, parallel with 8a (no shared files) |
| 8b glass and background, Motion toggle | `phase-8b-glass` | Wave 2, after 8a merges |
| 8c motion and hover moments | `phase-8c-motion` | Wave 2, parallel with 8b (own `motion.css`) |
| 8e skins (optional) | `phase-8e-skins` | Wave 3, after 8b merges |

## 7. Exit criteria

1. Dark theme follows the OS setting, the toggle persists across reloads, and there is no flash of the wrong theme on load.
2. The contrast test passes for light, dark and every skin, covering section 2.
3. Glass only on chrome, with all three fallbacks working.
4. Every section 5 moment works, and is replaced as listed under reduced motion and Motion off.
5. Mascot: 24 px grid or smaller, 6 colours or fewer, rects only, CSS-only animation, never covers or blocks a control, and every idle state in section 4 works.
6. No new dependencies, fonts or network calls. Built JS + CSS grows by less than 20 kB minified.
7. `STYLEGUIDE.md` matches `tokens.css`: dark table, light fixes, and the "Don't" list amended (glass allowed on chrome only, blur 10 px, still no glow).
8. `npm test` and `npm run typecheck` pass; no changes under `src/core/`, `src/devices/`, `src/transport/`.
9. Manual check on the BTR17 (Alexander): connect, write one slot, drop a file, in both themes.
