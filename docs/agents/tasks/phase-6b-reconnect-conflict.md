# Task: reconnect and FiiO Control conflict messages (Phase 6b)

Read @AGENTS.md first.

Task: make the main app recover from unplug/replug and explain connect failures caused by FiiO Control.
Phase: 6 (hardening).

Files you may change:
- `src/App.tsx`
- `src/ui/connectMessages.ts` (new)
- `src/ui/connectMessages.test.ts` (new)

Files to read for context (nothing else):
- `src/transport/webhid.ts` (`getGrantedFiioDevices`, `TransportTimeoutError`)
- `src/devices/fiio/models.ts` (`pickFiioInterface`)
- `src/devices/types.ts`
- `docs/design/STYLEGUIDE.md` (message style only)

Requirements:
1. `describeConnectError(e: unknown): string` in `connectMessages.ts`. Plain-language, no jargon:
   - `TransportTimeoutError`, or a DOMException named `NotAllowedError` / `NetworkError` / `InvalidStateError`: "Could not talk to the BTR17. Close FiiO Control (and any other tab using the device), then connect again."
   - `UnsupportedDeviceError`: keep its message.
   - `ProtocolError`: "The device answered in an unexpected way: <message>".
   - Anything else: the error message.
2. `App.tsx` uses it for connect errors.
3. When the adapter reports a disconnect, return to the connect screen with the message "BTR17 disconnected. Plug it back in and it will reconnect." (use the existing `message` class).
4. While on that screen after a disconnect, listen to `navigator.hid` `connect` events. When a FiiO device appears, call `getGrantedFiioDevices`, `pickFiioInterface`, and `connectFiio`. On failure show `describeConnectError`. Remove the listener on success and on unmount. No reconnect after the user never connected.
5. Tests for `describeConnectError` covering each branch. Use plain `Error` subclasses or `new DOMException(msg, name)`.

Out of scope:
- Changes to `Workspace.tsx`, the adapter or transport.
- Auto-connect on page load, retry loops, timers.
- New dependencies.

Done when:
- `npm test` and `npm run typecheck` pass, `npm run build` passes.

Reply with: files changed, test results, open issues. No explanations.
