# Task: static deploy to GitHub Pages (Phase 6c)

Read @AGENTS.md first.

Task: add a GitHub Actions workflow that tests, builds and deploys `dist/` to GitHub Pages.
Phase: 6 (hardening).

Files you may change:
- `.github/workflows/pages.yml` (new)
- `README.md` (one short "Deploy" section)

Files to read for context (nothing else):
- `package.json`
- `vite.config.ts` (already `base: './'`, do not change)

Requirements:
1. Trigger on push to `main` and manual dispatch. Permissions: `contents: read`, `pages: write`, `id-token: write`. Concurrency group `pages`.
2. Job `build`: checkout, setup-node (Node 22, npm cache), `npm ci`, `npm test`, `npm run build`, `actions/upload-pages-artifact` with `path: dist`.
3. Job `deploy`: `actions/deploy-pages`, environment `github-pages`.
4. Use current major versions of official actions only. No other actions, no secrets, no new npm dependencies.
5. README section: two lines saying Pages source must be set to "GitHub Actions" and that the app is fully static.

Out of scope:
- Cloudflare, custom domains, analytics, service workers.
- Any `src/` change.

Done when:
- `npm test`, `npm run typecheck` and `npm run build` pass.
- YAML is valid.

Reply with: files changed, test results, open issues. No explanations.
