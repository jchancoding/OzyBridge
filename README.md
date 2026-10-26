# OzyControl

A login-free web control center for USB DACs and amps. First target: FiiO BTR17.

- Import and export AutoEQ / Squiglink parametric EQ directly.
- Named EQ slots you can actually recognise.
- Runs entirely in the browser over WebHID (Chrome or Edge). No account, no backend.

Status: Phase 2 scaffold. See `docs/ROADMAP.md`.

## Develop

- `npm run dev`: start the Vite dev server
- `npm test`: run unit tests (Vitest)
- `npm run typecheck`: TypeScript check
- `npm run build`: typecheck and production build
- `npm run preview`: serve the production build

Docs:

- `docs/ROADMAP.md` for phases and model routing
- `docs/protocol/` for device protocol notes
- `docs/design/STYLEGUIDE.md` for visual design
- `AGENTS.md` for AI agent rules
