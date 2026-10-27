Read AGENTS.md first.

Task: Add a `?verify` page (one guided device test that ends in a single report submission), one FormSubmit channel shared with a general feedback form, and device-neutral landing copy.
Phase: 7b

Work only in /Users/jasper/Documents/GitHub/OzyBridge-verify (branch verify-and-landing). Never touch /Users/jasper/Documents/GitHub/OzyBridge. Do not commit or push.

Files you may change:
- AGENTS.md (network rule only, see 1)
- src/core/report.ts, src/core/report.test.ts (new)
- src/ui/submit.ts (new)
- src/ui/Verify.tsx, src/ui/verify.css (new)
- src/ui/Feedback.tsx (new)
- src/ui/reportLink.ts (delete, and remove its imports)
- src/ui/Probe.tsx (reduce to a redirect to `?verify`)
- src/App.tsx
- src/ui/Footer.tsx
- src/devices/fiio/probe.ts (reuse only; change exports if needed, not behaviour)

Files to read for context: the files above, src/devices/types.ts, src/devices/fiio/adapter.ts, src/devices/fiio/models.ts, src/devices/walkplay/models.ts, src/devices/walkplay/adapter.ts, src/transport/webhid.ts, src/core/eq.ts, docs/design/STYLEGUIDE.md, src/ui/tokens.css. Read Workspace.tsx only for class names and button styles.

Requirements:

1. Network rule. Edit AGENTS.md: the allowed runtime network calls are the GoatCounter page view and user-initiated FormSubmit posts (feedback and device reports). Reports contain only what the user sees on screen before sending. Nothing is sent automatically.

2. One submission channel. `src/ui/submit.ts` exports `FORMSUBMIT_ID` (string, currently `''`) and `submitForm(kind: 'feedback' | 'device-report', fields: Record<string, string>)`. It POSTs JSON to `https://formsubmit.co/ajax/${FORMSUBMIT_ID}` with `_subject` set to `[OzyBridge feedback]` or `[OzyBridge device report] <model>`, and `_captcha: 'false'`. It resolves true or false and never throws. When `FORMSUBMIT_ID` is empty, the feedback form and the report send button are hidden. Verify still runs and offers "Copy report".

3. No overlap. Device reports go only through `?verify`. Feedback goes only through the feedback form. Delete the GitHub issue link (`reportLink.ts`). The untested-device banner links to `?verify` ("Test this device"). The feedback form has a message field and an optional reply email, and no device fields. Its intro says: "Testing a device? Use the device test instead: it fills in the details for you." with a link to `?verify`.

4. Report model, in `src/core/report.ts`, pure, with tests:
   - `DeviceReport { schema: 1; app: string; browser: string; device: { name: string | null; vendorId: string; productId: string; firmware: string | null; listed: boolean; status: 'verified' | 'untested' | 'unlisted' }; steps: { id: StepId; result: 'pass' | 'fail' | 'skipped'; detail?: string }[]; notes: string }`
   - `StepId = 'read' | 'write' | 'readback' | 'replug' | 'restore' | 'probe'`
   - `formatReport(r): string`: readable plain text with the JSON appended, which the user sees before sending.
   - `testPreset(caps: DeviceCapabilities, current: EqProfile): EqProfile`: `current` with band 0 set to PK, 1000 Hz (or caps.freq clamp), +3 dB (clamped to caps.gain), Q 1 (clamped to caps.q). If PK is unsupported, use the first allowed type. It must differ from `current`. If `current` band 0 is already that value, use -3 dB.
   - `overall(r): 'pass' | 'fail' | 'partial'`.

5. `?verify` flow: one Start button, then automatic steps with a clear checklist that ticks as it goes.
   - Connect with the same chooser as the landing page. Unknown vendor/product: if FiiO vendor, run the existing read-only probe and record it as the `probe` step. Otherwise record unlisted with vendorId/productId and productName. Then go straight to the review.
   - Read: read the first writable slot (the active slot for single-slot devices). Show it. Pass if decoded without error. Keep it in memory as the backup.
   - Write: skip with detail "Writes are not enabled for this model yet" when writeSlot is unavailable (Walkplay: catch ReadOnlyDeviceError, or detect before writing). Otherwise ask once: "This will write a small test change to slot N, then put your EQ back." with Continue / Skip writing. Write `testPreset`. writeSlot already reads back. Record `write` and `readback` (fail detail = the WriteVerifyError message).
   - Replug: show "Unplug the device, plug it back in, then click Reconnect." Reconnect re-runs the chooser, reads the slot, and passes if it equals the test preset (use the existing profile equality in core/eq.ts). Chrome forgets the permission on unplug; say so in one line.
   - Restore: write the backup and pass if the read-back matches.
   - Any thrown error marks that step fail with the message, skips the rest, still goes to restore if a write happened, and then to review.
   - Review: show `formatReport`, an optional notes box, a Send report button (via submitForm) and a Copy report button. After sending, show "Thanks. This is how devices get marked as supported."
   - Never send commands beyond what the adapters already send. No new device commands.

6. Probe: `?probe` now redirects to `?verify` (replaceState then render Verify). Keep the probe logic in src/devices/fiio/probe.ts.

7. Landing copy (App.tsx). Friendly and device-neutral. Keep existing structure and classes. Add classes in verify.css only if needed.
   - Intro replacing "Control your DAC's EQ from the browser. Close FiiO Control first, then connect.": "OzyBridge puts your USB DAC's EQ in the browser. Drop in an AutoEQ, Squiglink or PeqDB file, pick a slot, done. No app, no account. Close your device's own app first, then connect."
   - Short feature line: "Import and export parametric EQ, name and compare slots, keep a preset library, and share an EQ as a link."
   - Supported devices list: group as Verified / Untested, using each model's `untested` flag. Walkplay models show "(read-only)".
   - Replace the probe paragraph with a "Get your device supported" section: "Got a DAC that's untested or missing from the list? Run the device test. It takes about two minutes, reads your EQ, tries one small change on a single slot, puts everything back, and sends us the result. One passing test is usually enough for us to mark a device as supported." with a link to `?verify`. Plus one line: "We're working hard to add more devices. Every test report speeds that up."
   - Remove the separate WALKPLAY_NOTE/UNTESTED_NOTE paragraph from the landing page if it is now covered by the list headings. Keep the connected-device banner.

8. Footer: add a "Feedback" link that opens the feedback form (route `?feedback`, render Feedback). Hidden when FORMSUBMIT_ID is empty.

9. Tests: src/core/report.test.ts covers testPreset (clamping, differs from current, PK fallback), formatReport (includes model and every step), and overall. Existing tests stay green. Remove tests that only covered reportLink.

Out of scope: auto-promotion of models, GitHub Actions, new device commands, Walkplay writes, styling beyond tokens.

Done when:
- npm test and npm run typecheck pass in the worktree
- Reply with: files changed, test results, open issues. No explanations.
