# OzyBridge

A login-free web control center for USB DACs and amps. First target: **FiiO BTR17**.

- Import and export AutoEQ / Squiglink parametric EQ and FiiO `.xml` presets.
- Named EQ slots you can actually recognise.
- Runs entirely in the browser over WebHID (Chrome or Edge). No account, no backend.

**Status:** Phase 5 UI is done; Phase 6 (hardening and release) is in progress. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Requirements

- **Browser:** Chrome or Edge (WebHID). Other browsers show an unsupported message.
- **Device:** FiiO BTR17 over USB when using connect and EQ features.
- **Development:** Node.js 22+ and npm (matches the GitHub Actions workflow).

## Run locally

```bash
git clone https://github.com/jchancoding/OzyBridge.git
cd OzyBridge
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/`), then use **Connect** and pick the BTR17 in the browser’s device chooser.

Optional: add `?bench` for low-level adapter checks on hardware (`src/ui/Bench.tsx`, protocol notes in `docs/protocol/fiio-btr17.md`).

Optional: add `?probe` for a read-only FiiO device report (`src/ui/Probe.tsx`) that users of unsupported models can copy back to us.

## Develop

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm run preview` | Serve the production build locally |

Docs:

- [`docs/ROADMAP.md`](docs/ROADMAP.md) for phases and model routing
- [`docs/protocol/`](docs/protocol/) for device protocol notes
- [`docs/design/STYLEGUIDE.md`](docs/design/STYLEGUIDE.md) for visual design
- [`AGENTS.md`](AGENTS.md) for AI agent rules

## Deploy (GitHub Pages)

Workflow: [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

1. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main`. CI runs tests, builds `dist/`, and deploys.

The app is fully static: no backend, no runtime network calls. After Pages is enabled, the site is typically at:

**https://jchancoding.github.io/OzyBridge/**
