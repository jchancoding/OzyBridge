# OzyBridge

A login-free web app that writes parametric EQ to USB DACs and amps. Drop in a Squiglink, AutoEQ, or PeqDB file, pick a slot, and it writes straight to the device. No format conversion, no account, no install.

Live: **https://jchancoding.github.io/OzyBridge/**

OzyBridge started as a replacement for FiiO Control's EQ import and export. It now also lists other FiiO models and a first set of Walkplay devices. The FiiO BTR17 is the only model confirmed on hardware. The rest are untested until someone runs the device test.

## What it does

- Import and export Squiglink, AutoEQ, and PeqDB parametric EQ. FiiO `.xml` is an extra for FiiO devices.
- Name slots, compare curves, keep a preset library in the browser, and share an EQ as a link.
- Read every write back before calling it done. One-level undo of the last write.
- OzyEQ (`?eq`): build and edit an EQ without a device, on any browser including phones and tablets, and download it as a Squiglink / AutoEQ `.txt`.
- Overlay an IEM measurement from squiglink (or your own file) and target curves (Harman IE 2019, Harman MoA 2025, JM-1, PEQdB Diamond) on the EQ graph.
- Close the device's own app before connecting. Device features need Chrome or Edge on a computer (WebHID).

## Devices

**Verified**

- FiiO BTR17

**Untested, writes enabled.** Settings come from public device captures. OzyBridge sends documented EQ commands, never firmware, and reads every write back. A bad result is a wrong EQ in one slot.

- FiiO KA15
- SNOWSKY Melody
- FiiO KA17
- FiiO QX13

**Untested, read-only**

- MOONDROP Marigold
- ddHiFi DSP Cable - Memory
- TANCHJIM-STARGATE II
- CrinEar Protocol Max
- EPZ TP35 Pro
- TANCHJIM-SPACE PRO
- NiceHCK Octave

Have a DAC that is missing or untested? Open the site and use **device test** (`?verify`). It reads the EQ, tries one small change on a single slot, puts the previous EQ back, and sends the result only if you press Send.

## Requirements

- **Browser:** Chrome or Edge on desktop for device features. Other browsers, phones and tablets get OzyEQ and an explanation.
- **Device:** USB DAC from the list above, for connect and EQ. The rest of the site works without one.
- **Development:** Node.js 22+ and npm.

## Run locally

```bash
git clone https://github.com/jchancoding/OzyBridge.git
cd OzyBridge
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/`) and use **Connect**.

| Query | Page |
| --- | --- |
| `?eq` | OzyEQ, the EQ editor without a device |
| `?verify` | Guided device test and report |
| `?feedback` | Feedback form |
| `?bench` | Low-level adapter checks on hardware |
| `?probe` | Redirects to `?verify` |

## Develop

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm run preview` | Serve the production build locally |

- [`context.md`](context.md) for the current state of the repo
- [`docs/ROADMAP.md`](docs/ROADMAP.md) for phase history
- [`docs/protocol/`](docs/protocol/) for device protocol notes
- [`docs/design/STYLEGUIDE.md`](docs/design/STYLEGUIDE.md) for visual design
- [`AGENTS.md`](AGENTS.md) for AI agent rules

## Deploy

Workflow: [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

1. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main`. CI runs tests, builds `dist/`, and deploys.

The site is static. There is no app backend. In production, a page view goes to [GoatCounter](https://www.goatcounter.com/) (path and referrer, no cookies, no EQ data). Feedback and device reports are sent only when you press Send, through [FormSubmit](https://formsubmit.co/). Squiglink measurements are fetched from the reviewer's database only when you open the IEM picker.

## Licence

[MIT](LICENSE). Protocol knowledge is derived in part from [jeromeof/devicePEQ](https://github.com/jeromeof/devicePEQ) (0BSD). Not affiliated with FiiO or any other manufacturer.
