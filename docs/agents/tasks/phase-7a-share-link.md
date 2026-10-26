```
Read @AGENTS.md first.

Task: Shareable EQ links: encode name, preamp and bands in the URL fragment; opening one offers to write it to the selected slot.
Phase: 7a
Branch: feat/7a-share-link

Files you may change:
- src/core/shareLink.ts (new)
- src/core/shareLink.test.ts (new)
- src/ui/Workspace.tsx

Files to read for context (nothing else):
- src/core/eq.ts
- src/core/fit.ts
- src/core/autoeq.ts (export side only, for band formatting conventions)
- docs/design/STYLEGUIDE.md

Requirements:
1. `encodeShareFragment({ name, profile })` returns `eq=<payload>` where payload is base64url (no padding) of compact JSON `{ v: 1, n, p, b: [[type, freq, gain, q, enabled 0|1], ...] }`. `decodeShareFragment(hash)` accepts `#eq=...` or `eq=...` and returns `{ ok: true, name, profile } | { ok: false, errors }`. Rejects bad base64, bad JSON, unknown `v`, unknown filter types, non-finite numbers, more than 64 bands. Unicode names survive.
2. Tests: round trip (including a non-ASCII name), each rejection, and that the fragment contains no `?` or `&` and stays under 2000 characters for 10 bands.
3. Workspace, download group: add `Copy share link`, copying `location.origin + location.pathname + '#' + fragment` to the clipboard. Show an ok notice, or an error notice if clipboard is blocked.
4. On mount, if `location.hash` decodes, fit it with `fitProfile` against the device capabilities. Show a confirm-style notice: `Shared EQ "<name>": write it to slot NN?` with `Write to slot NN` and `Dismiss`. Writing goes through `requestWrite` (normal overwrite confirm and read-back). Fit errors show as an error notice. Clear the hash with `history.replaceState` either way. Undecodable hashes are ignored silently.
5. The fragment is never sent anywhere. No new network calls, no query parameters.

Out of scope:
- Saving to a preset library (a later task adds that).
- Short links, QR codes, any server.

Done when:
- npm test and npm run typecheck pass
- A link copied from one slot, opened in a new tab with the device connected, offers the same EQ.

Commit on the branch above. Do not push.
Reply with: files changed, test results, open issues. No explanations.
```
