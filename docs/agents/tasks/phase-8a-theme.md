Read @AGENTS.md first.

Task: Add the dark "desert night" token set, the light-theme contrast fixes, a theme toggle, and a contrast test that enforces both.
Phase: 8 (visual refresh), task 8a. Spec: `docs/design/phase-8-spec.md` sections 1, 2 and the footer line in 5.

Files you may change:
- src/ui/tokens.css
- src/App.css
- index.html
- src/ui/prefs.ts (new), src/ui/prefs.test.ts (new)
- src/ui/contrast.ts (new), src/ui/contrast.test.ts (new)
- src/ui/Footer.tsx
- docs/design/STYLEGUIDE.md

Files to read for context (nothing else):
- docs/design/phase-8-spec.md, docs/design/STYLEGUIDE.md, and the files above

Requirements:
1. `tokens.css`: apply spec 1a to `:root`, add every spec 1b token, add the spec 1c set under `:root[data-theme='dark']`. Add `--oz-accent-fill` (light `#0077B6`, dark `#22C3F5`) for the primary button. Set `color-scheme: light` / `dark` on each.
2. `App.css`: replace every hard-coded colour with tokens (`#fff`, `#FFF1F4`, `#FFF8E1`, the drop-overlay rgba, `.drop-overlay span`). `.btn-primary` uses `--oz-accent-fill` and `--oz-on-accent`; hover is `filter: brightness(0.92)`. `rg -n '#[0-9a-fA-F]{3,8}\b|rgba?\(' src/App.css` returns nothing.
3. `index.html`: a small inline script before the module script reads `localStorage['ozy-theme']` in try/catch and sets `document.documentElement.dataset.theme` to `light` or `dark` (`system` or missing resolves via `matchMedia('(prefers-color-scheme: dark)')`). No flash on load.
4. `prefs.ts`: `THEME_KEY = 'ozy-theme'`, `type ThemePref = 'system' | 'light' | 'dark'`, pure `parseThemePref(raw: string | null): ThemePref` (unknown becomes `system`) and `resolveTheme(pref, prefersDark: boolean): 'light' | 'dark'`, plus a `useThemePref()` hook that stores the choice, sets `data-theme`, and follows OS changes live while `system`. Tests cover the pure functions.
5. `contrast.ts`: pure `contrastRatio(hexA, hexB)`, `composite(rgbaTop, hexUnder)` returning hex, and `readThemes(css)` returning `{ light, dark }` token maps (dark merged over light). `contrast.test.ts` imports `./tokens.css?raw` and asserts every pair in spec section 2 for both themes, with the failing pair named in the message.
6. `Footer.tsx`: a `THEME` row with three `.btn-secondary` buttons `AUTO`, `LIGHT`, `DARK` in a `role="group"` with `aria-label="Theme"` and `aria-pressed` on the current one.
7. `STYLEGUIDE.md`: colour table matches `tokens.css` (light fixes, `--oz-drop`, `--oz-drop-wash`, new semantic tokens), new dark table, principle 1 says dark is the "desert night" variant. Do not edit the glass or "Don't" lines; task 8b does.

Out of scope:
- Glass, background, motion, hover effects, mascot (other tasks).
- Anything under src/core/, src/devices/, src/transport/. Layout changes.

Done when:
- npm test and npm run typecheck pass, including the new contrast test.
- The `rg` check in requirement 2 is empty.

Reply with: files changed, test results, open issues. No explanations.
