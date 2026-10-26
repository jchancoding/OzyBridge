# OzyControl agent rules

OzyControl is a login-free, browser-based control center for USB DACs and amps.
MVP target: FiiO BTR17 over WebHID. Later: other FiiO models, then other vendors.

## Read first, and only what you need

- `docs/ROADMAP.md` for phase and scope. Do not work outside the current phase.
- `docs/protocol/fiio-btr17.md` before touching device code.
- `docs/design/STYLEGUIDE.md` before touching UI.
- Do not read `captures/` or vendor bundles unless the task says to. They are large.

## Stack

- Vite, TypeScript (strict), React, plain CSS with tokens from `src/ui/tokens.css`.
- Vitest for unit tests. No backend, no accounts, no analytics, no network calls at runtime.
- Chrome/Edge only (WebHID). Feature-detect and show a clear unsupported message elsewhere.

## Architecture boundaries

- `src/core/` pure TypeScript: EQ model, parsers, filter math, constraint fitting. No DOM, no WebHID.
- `src/transport/` WebHID (later Web Serial, Web Bluetooth). Bytes in, bytes out. No device knowledge.
- `src/devices/<vendor>/` protocol + per-model config. Implements `DeviceAdapter` from `src/devices/types.ts`.
- `src/ui/` React components. Talks to devices only through `DeviceAdapter`.
- Adding a device model must be a config entry, not new UI code, whenever the protocol family already exists.

## Device safety

- Never send commands outside the documented set in `docs/protocol/`. Never touch the DFU interface.
- Read before write. Verify writes by reading back.
- New commands are tested read-only first, then on a single band, then generally.

## Working rules for agents

- Stay inside the files listed in the task. If another file must change, stop and say why.
- Prefer editing over creating files. No new dependencies without approval.
- Every `src/core/` change ships with a Vitest test. Run `npm test` and `npm run typecheck` before finishing.
- Report results as: files changed, tests run, anything left undone. No long explanations.
- Code comments only for constraints the code cannot show (protocol quirks, timing requirements).

## Attribution

Protocol knowledge is derived in part from [jeromeof/devicePEQ](https://github.com/jeromeof/devicePEQ) (0BSD).
Do not copy FiiO's proprietary app code or assets into this repo.
