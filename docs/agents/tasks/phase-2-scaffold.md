# Task: Phase 2 scaffold

Read `AGENTS.md` first.

Task: scaffold the OzyControl app: tooling, design tokens, core EQ types, `DeviceAdapter` interface, and a tested WebHID transport.
Phase: 2 (see `docs/ROADMAP.md`).

## Files you may create or change

- `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`
- `src/main.tsx`, `src/App.tsx`, `src/App.css`
- `src/ui/tokens.css`
- `src/core/eq.ts`, `src/core/eq.test.ts`
- `src/devices/types.ts`
- `src/transport/webhid.ts`, `src/transport/webhid.test.ts`
- `README.md` (only the Status line and a "Develop" section with the npm scripts)

## Files to read for context (nothing else)

- `AGENTS.md`
- `docs/design/STYLEGUIDE.md` (tokens section only matters here)

## Dependencies (approved, nothing else)

Runtime: `react`, `react-dom`.
Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `@types/react`, `@types/react-dom`, `@types/w3c-web-hid`.
Use current stable versions. No ESLint, no Prettier, no CSS frameworks, no font packages.

## Requirements

1. **Tooling.** Vite + React + TypeScript with `strict: true`, `noUncheckedIndexedAccess: true`. Scripts: `dev`, `build` (typecheck then vite build), `preview`, `test` (`vitest run`), `typecheck` (`tsc --noEmit`). Vitest environment `node`. `"type": "module"`. Set `base: './'` in Vite config so the build works on static hosting.

2. **Tokens.** `src/ui/tokens.css` defines every token from the style guide on `:root` with identical names and values: colours, spacing `--oz-1`..`--oz-12`, `--oz-radius: 0`, `--oz-chamfer: 8px`, motion durations and `--oz-ease`. Font tokens: `--oz-font-display: 'Michroma', 'Inter', system-ui, sans-serif;` `--oz-font-ui: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;` `--oz-font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;`. Include a `prefers-reduced-motion` block that sets the durations to `1ms`.

3. **Core EQ types** in `src/core/eq.ts` (pure, no DOM):
   ```ts
   export type FilterType = 'PK' | 'LSC' | 'HSC';
   export interface EqBand { type: FilterType; freq: number; gain: number; q: number; enabled: boolean }
   export interface EqProfile { preamp: number; bands: EqBand[] }
   export interface Range { min: number; max: number }
   export function flatBand(freq: number): EqBand   // PK, gain 0, q 1, enabled true
   export function profilesEqual(a: EqProfile, b: EqProfile, tol?: { gain: number; freq: number; q: number }): boolean
   ```
   `profilesEqual` default tolerance: gain 0.05, freq 0.5, q 0.005. Disabled bands compare equal to enabled bands with gain 0. Test it in `eq.test.ts`.

4. **DeviceAdapter** in `src/devices/types.ts` (types only, imports from `src/core/eq.ts`):
   ```ts
   export interface EqSlot { id: number; label: string; writable: boolean }
   export interface DeviceCapabilities {
     maxBands: number; filterTypes: FilterType[];
     gain: Range; preamp: Range; q: Range; freq: Range;
     slots: EqSlot[]; eqOffSlotId: number | null;
   }
   export interface DeviceInfo { vendorId: number; productId: number; productName: string; firmware: string | null }
   export interface DeviceAdapter {
     readonly info: DeviceInfo;
     readonly capabilities: DeviceCapabilities;
     disconnect(): Promise<void>;
     onDisconnect(cb: () => void): () => void;   // returns unsubscribe
     getActiveSlot(): Promise<number>;
     setActiveSlot(id: number): Promise<void>;
     readActiveProfile(): Promise<EqProfile>;
     writeSlot(id: number, profile: EqProfile): Promise<EqProfile>;  // resolves with the read-back profile
   }
   ```

5. **WebHID transport** in `src/transport/webhid.ts`. Bytes in, bytes out, no device knowledge.
   - `isWebHidSupported(): boolean` (checks `navigator.hid` safely when `navigator` is undefined).
   - `export type HidLike = Pick<HIDDevice, 'opened' | 'open' | 'close' | 'sendReport' | 'addEventListener' | 'removeEventListener' | 'collections' | 'productName' | 'vendorId' | 'productId'>` so tests can pass a fake.
   - `class HidTransport` constructed with `(device: HidLike, opts: { reportId: number; minGapMs?: number; timeoutMs?: number })`. Defaults: `minGapMs` 0, `timeoutMs` 1000.
   - `open()`: opens the device if not opened; finds the output report length for `reportId` from `collections` (sum of `reportSize * reportCount` over the report's items, divided by 8). If not found, throw.
   - `send(bytes: Uint8Array)`: zero-pads to the output report length (throws if longer), sends with `sendReport(reportId, padded)`.
   - `request(bytes, match: (reply: Uint8Array) => boolean)`: sends, then resolves with the first input report on `reportId` for which `match` returns true. Rejects with a `TransportTimeoutError` after `timeoutMs`. Non-matching reports are ignored.
   - All `send` and `request` calls go through one internal FIFO queue: never two operations in flight, and at least `minGapMs` between the end of one operation and the start of the next.
   - `close()`: rejects pending and queued operations with `TransportClosedError`, removes listeners, closes the device.
   - `requestFiioDevice(): Promise<HIDDevice | null>` calls `navigator.hid.requestDevice({ filters: [{ vendorId: 0x2972 }] })` and returns the first device or null. `getGrantedFiioDevices(): Promise<HIDDevice[]>`.
   - Tests in `webhid.test.ts` with a fake `HidLike` and Vitest fake timers: report length derivation, padding, too-long frame throws, request matching skips non-matching reports, timeout, FIFO order, `minGapMs` respected, close rejects pending.

6. **App shell.** `App.tsx`: if WebHID is unsupported, show "OzyControl needs Chrome or Edge on desktop (WebHID)." Otherwise a `CONNECT` primary button that calls `requestFiioDevice()` and shows the product name. Style with tokens only; chamfered primary button per the style guide. No routing, no state library.

## Out of scope

- Any FiiO protocol code (frames, CRC, commands). That is Phase 4.
- EQ parsers, filter math, graphs, slot UI, fonts, dark mode.
- Sending anything to a real device beyond the `requestDevice` picker.

## Done when

- `npm test` and `npm run typecheck` and `npm run build` pass.
- No files outside the list above were created or changed (except `node_modules/`, `dist/`).

Reply with: files changed, test results (counts), open issues. No explanations.
