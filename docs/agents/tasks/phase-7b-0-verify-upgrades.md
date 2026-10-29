Read AGENTS.md first.

Task: Upgrade `?verify` so it can safely meet unknown DSP cables: wider picker, a descriptor-only probe, richer reports, a single-band write step and a "device restarted on save" step. No new device commands.
Phase: 7b

Work only in /Users/jasper/Documents/GitHub/OzyBridge-7b0 (branch 7b-verify-upgrades). Do not commit or push.

Files you may change:
- src/transport/webhid.ts, src/transport/webhid.test.ts
- src/devices/registry.ts, src/devices/registry.test.ts (new)
- src/devices/types.ts
- src/devices/fiio/adapter.ts, src/devices/walkplay/adapter.ts (wire `rawFrames` only)
- src/core/report.ts, src/core/report.test.ts
- src/ui/Verify.tsx, src/ui/verify.css
- src/App.tsx (use the registry instead of inline matching; no copy changes)

Files to read for context (nothing else): src/devices/fiio/models.ts, src/devices/walkplay/models.ts, src/devices/fiio/probe.ts, src/core/eq.ts.

Requirements:
1. Picker: `requestConnectDevices` also offers vendor `0x31B2`. A connected `0x31B2` device with no matching model is "unlisted".
2. Registry: `src/devices/registry.ts` exports `matchFamily(vendorId, productId, productName): 'fiio' | 'walkplay' | null`. It matches exact vendor and product ID only, via the existing model tables. No fallback family, ever. App.tsx and Verify.tsx both use it. Tests: an unknown `0x31B2` product returns null; an unknown `0x2972` product returns null; every listed model returns its family.
3. Descriptor-only probe: `describeHid(device)` in webhid.ts returns `{ productName, vendorId, productId, collections: { usagePage, usage, input: number[], output: number[], feature: number[] }[] }` (report IDs per collection). It does not open the device. For an unlisted non-FiiO device, Verify records step `probe` with this descriptor and sends nothing. Unlisted FiiO-vendor devices keep today's FiiO probe.
4. Raw frames: `DeviceAdapter` gets optional `rawFrames?(): { dir: 'out' | 'in'; hex: string }[]`, which returns and clears the frames since the last call. HidTransport gets a `tap(cb)` that sees every sent and received report. FiiO and Walkplay adapters implement `rawFrames` with it.
5. Report schema 2 (`src/core/report.ts`): `schema: 2`; `device.descriptor?` (shape from 3); each step may carry `bands?: string[]` (one readable line per band, e.g. `PK 1000 Hz +3.0 dB Q1.00`) and `rawHex?: string[]`; `StepId` adds `'band'` and `'restart'`. The read step stores decoded bands and raw hex. `formatReport` prints them. `device.firmware` comes only from `adapter.info.firmware` (a protocol read). Never read `HIDDevice.deviceVersion`; add a test that greps `src/` for it and fails if found.
6. Single-band step (`band`): before the full-slot `write`, for any family other than `fiio`, if the adapter has optional `writeBand?(slotId, index, band): Promise<EqProfile>` (add it to `DeviceAdapter`), change band 0 only, then read the slot back and compare. If `writeBand` is missing, record `skipped` with "Single-band writes are not enabled for this model yet". If the band step fails, stop writing and go to restore.
7. Restart step (`restart`): if `onDisconnect` fires during or within 5 s after a write, show "The device restarted after saving. Click Reconnect." Reconnect first tries `navigator.hid.getDevices()` for the same vendor and product ID, then falls back to the chooser. Read the slot back and compare with what was written. The detail says "permission kept" or "chooser needed". If no disconnect happens, record `skipped` with "No restart".
8. Tests: report.test.ts covers schema 2 formatting (bands, raw hex, descriptor), and the `deviceVersion` guard. registry.test.ts as in 2. webhid.test.ts covers `describeHid` and `tap` with a fake device.

Out of scope: new adapters, new device commands, KTMicro or Moondrop code, landing copy, styling beyond tokens.

Done when:
- npm test and npm run typecheck pass in the worktree
- An unknown `0x31B2` device in `?verify` produces a report with the descriptor and no frames sent (fake-device test proves zero `sendReport` calls)

Hardware (owner, after merge, deployed site): run `?verify` on the Chu II DSP, the Allegro Mini, and the Moondrop May or FreeDSP cable. Paste only the "Device" and "probe" lines from each report.

Reply with: files changed, test results, open issues. No explanations.
