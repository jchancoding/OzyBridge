# OzyBridge style guide

Inspiration: WipeOut Pure, WipeOut 2048, Ridge Racer (PSP, PS Vita).
The feeling: a clean, bright race-HUD. White space, precise geometry, one confident accent, numbers that look like telemetry.

Tokens below are the source of truth. They live in `src/ui/tokens.css` once scaffolded; this file and that file must match.

## Principles

1. **Light and clean.** Bright off-white surfaces, cool greys, lots of air. Light is the primary theme; dark is the "desert night" variant of the same system.
2. **Precision geometry.** Straight lines, 45° chamfered corners, thin rules. No soft blobs, no heavy shadows, no rounded pills.
3. **One accent at a time.** Electric cyan is the system colour. Signal colours only carry meaning (warning, clipping, active).
4. **Data is the hero.** The EQ curve and numbers get the most contrast. Chrome stays quiet.
5. **Fast, not flashy.** Motion is quick and linear-feeling, like a HUD updating. Nothing bounces.

## Colour

| Token | Value | Use |
|---|---|---|
| `--oz-bg` | `#F4F6F8` | App background |
| `--oz-surface` | `#FFFFFF` | Panels |
| `--oz-surface-2` | `#E9EDF1` | Inset areas, inactive slots |
| `--oz-line` | `#C9D1D9` | Hairlines, grid |
| `--oz-line-strong` | `#88949F` | Axis lines, dividers |
| `--oz-text` | `#101820` | Primary text |
| `--oz-text-2` | `#4A5563` | Secondary text |
| `--oz-text-3` | `#5F6975` | Labels, units |
| `--oz-accent` | `#0086BD` | System accent: focus, selection, primary curve |
| `--oz-accent-strong` | `#006FAA` | Accent text on light surfaces |
| `--oz-accent-fill` | `#0077B6` | Primary button fill |
| `--oz-accent-wash` | `#DFF4FC` | Selected backgrounds |
| `--oz-signal` | `#FF5A1F` | Active / live / write in progress |
| `--oz-warn` | `#A87400` | Constraint warnings (band dropped, value clamped) |
| `--oz-danger` | `#D61F45` | Clipping, write failure, disconnect |
| `--oz-ok` | `#0B7F55` | Verified write, connected |
| `--oz-drop` | `#C25E00` | Drop target outline |
| `--oz-drop-wash` | `#FFF0DC` | Drop target background |
| `--oz-curve-2` | `#B34DFF` | Secondary curve (target or comparison) |
| `--oz-on-accent` / `--oz-on-danger` / `--oz-on-ok` | `#FFFFFF` | Label on the matching fill |
| `--oz-danger-wash` | `#FFF1F4` | Error notice, invalid field |
| `--oz-warn-wash` | `#FFF8E1` | Confirm notice |
| `--oz-scrim` | `rgb(16 24 32 / 0.12)` | Drag overlay |
| `--oz-inverse` / `--oz-on-inverse` | `#101820` / `#FFFFFF` | Drag overlay label |
| `--oz-glass` | `rgb(255 255 255 / 0.92)` | Chrome panels (used from task 8b) |
| `--oz-blur` | `10px` | Chrome panel blur (used from task 8b) |

### Dark theme: desert night

Set with `<html data-theme="dark">`. Tokens not listed (spacing, motion, `--oz-blur`) are shared.

| Token | Value |
|---|---|
| `--oz-bg` | `#0E131A` |
| `--oz-surface` | `#161D26` |
| `--oz-surface-2` | `#1F2833` |
| `--oz-line` | `#2E3A47` |
| `--oz-line-strong` | `#6B7888` |
| `--oz-text` | `#E8EDF2` |
| `--oz-text-2` | `#A9B4C0` |
| `--oz-text-3` | `#9AA6B4` |
| `--oz-accent` | `#22C3F5` |
| `--oz-accent-strong` | `#6BD6FF` |
| `--oz-accent-fill` | `#22C3F5` |
| `--oz-accent-wash` | `#0F2E3D` |
| `--oz-signal` | `#FF7A45` |
| `--oz-warn` | `#FFC633` |
| `--oz-danger` | `#FF5C7A` |
| `--oz-ok` | `#2FD49A` |
| `--oz-drop` | `#FF9A3D` |
| `--oz-drop-wash` | `#3A2610` |
| `--oz-curve-2` | `#C77DFF` |
| `--oz-on-accent` / `--oz-on-danger` / `--oz-on-ok` | `#0E131A` |
| `--oz-danger-wash` | `#3A1620` |
| `--oz-warn-wash` | `#3A3010` |
| `--oz-scrim` | `rgb(0 0 0 / 0.45)` |
| `--oz-inverse` / `--oz-on-inverse` | `#E8EDF2` / `#101820` |
| `--oz-glass` | `rgb(22 29 38 / 0.92)` |

Rules:

- Text on white uses `--oz-text` or `--oz-accent-strong`, never `--oz-accent` (contrast).
- Signal colours never decorate. If it's orange, something is happening.
- Gradients: only a subtle linear `--oz-surface` to `--oz-bg` on large panels, and the speed-stripe motif below.

## Typography

All fonts are SIL Open Font License; self-host them, no font CDN.

| Role | Font | Notes |
|---|---|---|
| Display | Michroma | Screen titles, device name. Uppercase, tracking `0.08em`. Use sparingly. |
| UI | Inter | Everything else. |
| Numeric | JetBrains Mono | All values: Hz, dB, Q, slot numbers. `font-variant-numeric: tabular-nums`. |

Scale (rem): `0.75` label, `0.875` body small, `1` body, `1.25` section, `1.75` screen title, `2.5` hero readout.

- Labels: uppercase, `0.75rem`, weight 600, tracking `0.12em`, `--oz-text-3`.
- Units sit after values in `--oz-text-3`, smaller: `105` `Hz`.
- Never use Michroma for numbers or body text.

## Geometry and layout

- Base unit 4 px. Spacing tokens: `--oz-1` 4, `--oz-2` 8, `--oz-3` 12, `--oz-4` 16, `--oz-6` 24, `--oz-8` 32, `--oz-12` 48.
- Corners: `--oz-radius` is `0`. Panels and buttons use a chamfer of `--oz-chamfer` (8 px) on the top-left and bottom-right only, via `clip-path`.
- Borders: 1 px `--oz-line`. Selected: 2 px `--oz-accent` left edge bar, not a full outline.
- Grid: 12 columns, 24 px gutters, max width 1280 px. The EQ graph spans full width on all sizes.
- Shadows: none, except a 1 px `--oz-line` offset under floating menus.

## Motifs

- **Speed stripes.** Three parallel 45° bars in accent at 100/60/30% opacity. Used on the connect screen and as a write-in-progress indicator. Never as wallpaper.
- **Chevrons.** `›` style arrows for navigation and stepping.
- **Index tags.** Small boxed numerals `01`–`10` on slots, in JetBrains Mono, like grid positions.
- **Telemetry rules.** Thin tick-marked lines under section headers.

## Background

- Fixed `body::before` at `z-index: -2`: perspective grid in `--oz-line`, max 35% opacity, fading toward a mid-screen horizon, 8 s linear drift. Dark adds `body::after` scanlines (2 px period, max 3% white). Both `pointer-events: none`.
- Chrome (`.sticky`, `.hud`, ok/info/busy notices) is glass: `--oz-glass` plus one blur. Error and confirm notices stay solid. Fallback to solid under `prefers-reduced-transparency`, `prefers-contrast: more`, or no `backdrop-filter`.

## Mascot

- Ozy walks in a fixed layer at `z-index: -1`, in front of the grid and behind all content. See `docs/design/phase-8-spec.md` section 4.

## Components

- **Button, primary:** accent fill, white uppercase label, chamfered. Hover lightens 8%, active uses `--oz-accent-strong`.
- **Button, secondary:** white fill, 1 px `--oz-line-strong` border, text `--oz-text`.
- **Button, danger:** only for destructive actions (overwrite slot, reset). Requires confirmation.
- **Slot card:** index tag, preset name (Inter 600), band count and preamp as numeric caption, mini curve thumbnail. Active slot gets the left accent bar and `--oz-accent-wash` background.
- **Band row:** type, frequency, gain, Q in fixed numeric columns. Inline edit; arrow keys step values; shift-arrow steps coarse.
- **EQ graph:** log frequency axis 20 Hz–20 kHz, ±15 dB. Grid in `--oz-line`, 0 dB line in `--oz-line-strong`, curve 2 px `--oz-accent`, target curve 1.5 px dashed `--oz-curve-2`, band handles as small diamonds. Clipping region tinted `--oz-danger` at 8%.
- **Status HUD:** top bar showing device, connection state dot, firmware, active slot. Monospace values.
- **Toast:** slides from the right, chamfered, coloured left bar by meaning, auto-dismiss 4 s except errors.

## Motion

- Durations: `--oz-fast` 120 ms (hover, press), `--oz-base` 200 ms (panels, toasts), `--oz-slow` 320 ms (screen transitions).
- Easing: `cubic-bezier(0.2, 0, 0, 1)`. No spring, no bounce, no overshoot.
- Screen transitions slide horizontally a short distance with a fade, like a menu change in WipeOut Pure.
- Respect `prefers-reduced-motion`: replace slides with fades, disable stripe animation.
- Ambient motion (grid drift, scanlines, mascot) stops under `prefers-reduced-motion` or when the footer Motion toggle is OFF (`data-motion='off'`, stored as `ozy-motion`).

## Iconography

- 1.5 px stroke, square caps, 24 px grid, geometric. No filled cartoon icons, no emoji.

## Voice

- Short, uppercase labels: `CONNECT`, `WRITE TO SLOT 03`, `BYPASS`.
- Messages in plain sentence case: "Slot 3 saved and verified."
- Units always shown. Never "dB" without a value, never a value without a unit.

## Accessibility

- WCAG AA contrast for all text. Focus ring: 2 px `--oz-accent` with 2 px offset, always visible on keyboard focus.
- Every graph interaction has a keyboard and numeric equivalent.
- Colour is never the only signal: pair it with an icon or text.

## Don't

- No neon glow. Blur only on sticky chrome (`--oz-blur`), never behind data (graph, band table, slot cards, inputs).
- No dark full-screen backgrounds in light theme.
- No more than one display-font line per screen.
- No rounded corners.
