import { useCallback, useMemo, useState } from 'react';
import { exportAutoEq } from '../core/autoeq';
import { profilesEqual, type EqProfile } from '../core/eq';
import {
  formatReport,
  testPreset,
  type DeviceReport,
  type StepId,
} from '../core/report';
import { connectFiio } from '../devices/fiio/adapter';
import { FIIO_VENDOR_ID, findFiioModel, pickFiioInterface } from '../devices/fiio/models';
import { probeFiio } from '../devices/fiio/probe';
import { connectWalkplay } from '../devices/walkplay/adapter';
import { findWalkplayModel, pickWalkplayInterface } from '../devices/walkplay/models';
import type { DeviceAdapter } from '../devices/types';
import { WriteVerifyError } from '../devices/types';
import { requestConnectDevices } from '../transport/webhid';
import { describeConnectError } from './connectMessages';
import { Footer } from './Footer';
import { FORMSUBMIT_ID, submitForm } from './submit';
import './verify.css';

const STEP_ORDER: StepId[] = ['probe', 'read', 'write', 'readback', 'replug', 'restore'];
const STEP_LABEL: Record<StepId, string> = {
  probe: 'Identify device',
  read: 'Read your EQ',
  write: 'Write a test change',
  readback: 'Read it back',
  replug: 'Survives unplug and replug',
  restore: 'Put your EQ back',
};
const hex4 = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;

function deviceStatus(
  listed: boolean,
  untested: boolean | undefined,
): DeviceReport['device']['status'] {
  if (!listed) return 'unlisted';
  return untested ? 'untested' : 'verified';
}

function emptySteps(): DeviceReport['steps'] {
  return STEP_ORDER.map((id) => ({ id, result: 'skipped' as const }));
}

function setStep(
  steps: DeviceReport['steps'],
  id: StepId,
  result: 'pass' | 'fail' | 'skipped',
  detail?: string,
): DeviceReport['steps'] {
  const i = steps.findIndex((s) => s.id === id);
  if (i < 0) return [...steps, { id, result, detail }];
  const next = [...steps];
  next[i] = { id, result, detail };
  return next;
}

function pickTestSlot(adapter: DeviceAdapter): Promise<number> {
  const slots = adapter.capabilities.slots;
  if (slots.length === 1) return adapter.getActiveSlot();
  const writable = slots.find((s) => s.writable);
  return Promise.resolve(writable?.id ?? slots[0]!.id);
}

function writesEnabled(adapter: DeviceAdapter): boolean {
  return findWalkplayModel(adapter.info.vendorId, adapter.info.productId, adapter.info.productName) === undefined &&
    adapter.capabilities.slots.some((s) => s.writable);
}

type Phase = 'idle' | 'running' | 'write-prompt' | 'replug' | 'review';

export function Verify() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DeviceReport>(() => ({
    schema: 1,
    app: 'OzyBridge',
    browser: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    device: {
      name: null,
      vendorId: '',
      productId: '',
      firmware: null,
      listed: false,
      status: 'unlisted',
    },
    steps: emptySteps(),
    notes: '',
  }));
  const [notes, setNotes] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [adapter, setAdapter] = useState<DeviceAdapter | null>(null);
  const [backup, setBackup] = useState<EqProfile | null>(null);
  const [preset, setPreset] = useState<EqProfile | null>(null);
  const [slotId, setSlotId] = useState<number | null>(null);
  const [wroteTest, setWroteTest] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [activity, setActivity] = useState<{ step: StepId; text: string } | null>(null);

  const stepState = useCallback(
    (id: StepId): 'pending' | 'running' | 'pass' | 'fail' | 'skipped' => {
      if (activity?.step === id) return 'running';
      const s = report.steps.find((x) => x.id === id);
      if (!s) return 'pending';
      if (s.result === 'pass') return 'pass';
      if (s.result === 'fail') return 'fail';
      if (s.result === 'skipped') return 'skipped';
      return 'pending';
    },
    [report.steps, activity],
  );
  const visibleSteps = STEP_ORDER.filter(
    (id) => id !== 'probe' || report.steps.find((s) => s.id === 'probe')?.result !== 'skipped',
  );
  const doneCount = visibleSteps.filter((id) => ['pass', 'fail'].includes(stepState(id))).length;
  const slotLabel = (id: number) => adapter?.capabilities.slots.find((s) => s.id === id)?.label ?? 'the custom slot';

  const fullReport = useMemo(() => ({ ...report, notes }), [report, notes]);
  const reportText = useMemo(() => formatReport(fullReport), [fullReport]);

  const finishReview = (steps: DeviceReport['steps'], dev: DeviceReport['device']) => {
    setActivity(null);
    setReport((r) => ({ ...r, device: dev, steps }));
    setPhase('review');
  };

  const failAndRest = async (
    steps: DeviceReport['steps'],
    id: StepId,
    message: string,
    a: DeviceAdapter | null,
    dev: DeviceReport['device'],
    bk: EqProfile | null,
    sid: number | null,
    didWrite: boolean,
  ) => {
    let next = setStep(steps, id, 'fail', message);
    for (const sid2 of STEP_ORDER) {
      if (sid2 === id) continue;
      const cur = next.find((s) => s.id === sid2);
      if (cur && cur.result === 'skipped' && STEP_ORDER.indexOf(sid2) > STEP_ORDER.indexOf(id)) {
        next = setStep(next, sid2, 'skipped');
      }
    }
    if (didWrite && bk !== null && sid !== null && a) {
      setActivity({ step: 'restore', text: 'Putting your EQ back and checking it...' });
      try {
        await a.writeSlot(sid, bk);
        next = setStep(next, 'restore', 'pass');
      } catch (e) {
        next = setStep(next, 'restore', 'fail', e instanceof Error ? e.message : String(e));
      }
    }
    finishReview(next, dev);
  };

  const connectDevice = async (): Promise<
    | { kind: 'adapter'; adapter: DeviceAdapter; device: DeviceReport['device'] }
    | { kind: 'probe'; device: DeviceReport['device']; probeDetail: string }
    | { kind: 'unlisted'; device: DeviceReport['device'] }
    | null
  > => {
    const granted = await requestConnectDevices();
    const walk = pickWalkplayInterface(granted);
    if (walk) {
      const a = await connectWalkplay(walk);
      const model = findWalkplayModel(a.info.vendorId, a.info.productId, a.info.productName)!;
      return {
        kind: 'adapter',
        adapter: a,
        device: {
          name: model.name,
          vendorId: hex4(a.info.vendorId),
          productId: hex4(a.info.productId),
          firmware: a.info.firmware,
          listed: true,
          status: deviceStatus(true, model.untested),
        },
      };
    }
    const fiio = pickFiioInterface(granted);
    if (fiio) {
      const a = await connectFiio(fiio);
      const model = findFiioModel(a.info.vendorId, a.info.productId)!;
      return {
        kind: 'adapter',
        adapter: a,
        device: {
          name: model.name,
          vendorId: hex4(a.info.vendorId),
          productId: hex4(a.info.productId),
          firmware: a.info.firmware,
          listed: true,
          status: deviceStatus(true, model.untested),
        },
      };
    }
    const fiioRaw = granted.find((d) => d.vendorId === FIIO_VENDOR_ID);
    if (fiioRaw) {
      const lines = await probeFiio(fiioRaw);
      return {
        kind: 'probe',
        device: {
          name: fiioRaw.productName || null,
          vendorId: hex4(fiioRaw.vendorId),
          productId: hex4(fiioRaw.productId),
          firmware: null,
          listed: false,
          status: 'unlisted',
        },
        probeDetail: lines.join('\n'),
      };
    }
    const d = granted[0];
    if (!d) return null;
    return {
      kind: 'unlisted',
      device: {
        name: d.productName || null,
        vendorId: hex4(d.vendorId),
        productId: hex4(d.productId),
        firmware: null,
        listed: false,
        status: 'unlisted',
      },
    };
  };

  const runAfterConnect = async (
    a: DeviceAdapter,
    dev: DeviceReport['device'],
    steps: DeviceReport['steps'],
  ) => {
    let next = steps;
    const sid = await pickTestSlot(a);
    setSlotId(sid);
    let readProfile: EqProfile;
    setActivity({ step: 'read', text: 'Reading your EQ from the device...' });
    try {
      readProfile = await a.readSlot(sid);
      setBackup(readProfile);
      setDisplayText(exportAutoEq(readProfile).trimEnd());
      next = setStep(next, 'read', 'pass');
      setReport((r) => ({ ...r, steps: next, device: dev }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await failAndRest(next, 'read', msg, a, dev, null, sid, false);
      return;
    }

    if (!writesEnabled(a)) {
      next = setStep(setStep(next, 'write', 'skipped', 'Writes are not enabled for this model yet'), 'readback', 'skipped');
      setReport((r) => ({ ...r, steps: next }));
      finishReview(next, dev);
      return;
    }

    const test = testPreset(a.capabilities, readProfile);
    setPreset(test);
    setActivity(null);
    setReport((r) => ({ ...r, steps: next }));
    setPhase('write-prompt');
  };

  const start = async () => {
    setError(null);
    setBusy(true);
    setPhase('running');
    let steps = emptySteps();
    try {
      const conn = await connectDevice();
      if (!conn) {
        setError('No device was selected.');
        setPhase('idle');
        setBusy(false);
        return;
      }
      if (conn.kind === 'probe') {
        steps = setStep(steps, 'probe', 'pass', conn.probeDetail);
        finishReview(steps, conn.device);
        setBusy(false);
        return;
      }
      if (conn.kind === 'unlisted') {
        finishReview(steps, conn.device);
        setBusy(false);
        return;
      }
      setAdapter(conn.adapter);
      setReport((r) => ({ ...r, device: conn.device }));
      await runAfterConnect(conn.adapter, conn.device, steps);
    } catch (e) {
      setError(describeConnectError(e));
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    await adapter?.disconnect().catch(() => {});
    location.reload();
  };

  const continueWrite = async () => {
    if (!adapter || backup === null || slotId === null || preset === null) return;
    setBusy(true);
    setPhase('running');
    let next = report.steps;
    const dev = report.device;
    setActivity({ step: 'write', text: 'Writing the test change and reading it back. This takes a few seconds...' });
    try {
      await adapter.writeSlot(slotId, preset);
      next = setStep(next, 'write', 'pass');
      next = setStep(next, 'readback', 'pass');
      setActivity(null);
      setWroteTest(true);
      setReport((r) => ({ ...r, steps: next }));
      setPhase('replug');
    } catch (e) {
      const msg =
        e instanceof WriteVerifyError ? e.message : e instanceof Error ? e.message : String(e);
      next = setStep(setStep(next, 'write', 'fail', msg), 'readback', 'fail', msg);
      await failAndRest(next, 'write', msg, adapter, dev, backup, slotId, true);
    } finally {
      setBusy(false);
    }
  };

  const reconnect = async () => {
    setError(null);
    setBusy(true);
    let next = report.steps;
    const dev = report.device;
    const bk = backup;
    const sid = slotId;
    const test = preset;
    const didWrite = wroteTest;
    try {
      await adapter?.disconnect().catch(() => {});
      setAdapter(null);
      const conn = await connectDevice();
      if (!conn || conn.kind !== 'adapter') {
        setError('Reconnect to the same device.');
        setBusy(false);
        return;
      }
      const a = conn.adapter;
      setAdapter(a);
      setActivity({ step: 'replug', text: 'Checking the test change survived the replug...' });
      const read = await a.readSlot(sid ?? (await pickTestSlot(a)));
      if (test && profilesEqual(read, test)) {
        next = setStep(next, 'replug', 'pass');
      } else {
        next = setStep(next, 'replug', 'fail', 'Read profile does not match the test preset');
      }
      setReport((r) => ({ ...r, steps: next, device: dev }));
      if (bk !== null && sid !== null && didWrite) {
        setActivity({ step: 'restore', text: 'Putting your EQ back and checking it...' });
        try {
          await a.writeSlot(sid, bk);
          next = setStep(next, 'restore', 'pass');
        } catch (e) {
          next = setStep(next, 'restore', 'fail', e instanceof Error ? e.message : String(e));
        }
        setReport((r) => ({ ...r, steps: next }));
      }
      finishReview(next, dev);
    } catch (e) {
      setError(describeConnectError(e));
    } finally {
      setBusy(false);
    }
  };

  const copyReport = async () => {
    await navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sendReport = async () => {
    setSendFailed(false);
    const ok = await submitForm('device-report', {
      model: fullReport.device.name ?? 'unknown',
      report: reportText,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
    });
    if (ok) setSent(true);
    else setSendFailed(true);
  };

  return (
    <main className="app screen">
      <h1 className="display">Device test</h1>
      <section className="intro">
        <p>
          A short guided test: read your EQ, try one small change on a single slot, put it back, and share the result.
          Close your device&apos;s own app first.
        </p>
        <p>
          At the end you send us the test report. We check it by hand, and once it passes, your device is added to the
          supported devices list.
        </p>
      </section>

      {phase !== 'idle' && phase !== 'review' && (
        <>
          <progress className="verify-progress" max={visibleSteps.length} value={doneCount} aria-label="Test progress" />
          <ol className="verify-checklist">
            {visibleSteps.map((id) => (
              <li key={id} data-state={stepState(id)}>{STEP_LABEL[id]}</li>
            ))}
          </ol>
          {activity && <p className="message" role="status">{activity.text}</p>}
        </>
      )}

      {phase === 'idle' && (
        <button className="btn-primary" type="button" disabled={busy} onClick={start}>Start</button>
      )}

      {phase === 'write-prompt' && slotId !== null && (
        <div className="verify-field">
          <p className="message">
            Next, OzyBridge writes one small test change to {slotLabel(slotId)}, checks it, and later puts
            your EQ back exactly as it was.
          </p>
          <div className="bench-row">
            <button className="btn-primary" type="button" disabled={busy} onClick={continueWrite}>Continue</button>
            <button className="btn-secondary" type="button" disabled={busy} onClick={cancel}>Cancel test</button>
          </div>
        </div>
      )}

      {phase === 'replug' && (
        <div className="verify-field">
          <p className="message">
            Unplug the device, plug it back in, then click Reconnect. Chrome forgets the permission when the device is unplugged.
          </p>
          <button className="btn-primary" type="button" disabled={busy} onClick={reconnect}>Reconnect</button>
        </div>
      )}

      {displayText && phase !== 'review' && phase !== 'idle' && phase !== 'write-prompt' && (
        <pre className="verify-report">{displayText}</pre>
      )}

      {phase === 'review' && (
        <>
          <pre className="verify-report">{reportText}</pre>
          <label className="verify-field">
            <span className="label">Notes (optional)</span>
            <textarea className="verify-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <label className="verify-field">
            <span className="label">Display name</span>
            <input
              className="verify-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
              placeholder="Name to credit on the supported list"
            />
          </label>
          <div className="bench-row">
            {FORMSUBMIT_ID && (
              <button className="btn-primary" type="button" disabled={sent} onClick={sendReport}>
                {sent ? 'Sent' : 'Send report'}
              </button>
            )}
            <button className="btn-secondary" type="button" onClick={copyReport}>{copied ? 'Copied' : 'Copy report'}</button>
            <a className="btn-secondary verify-back" href="/">Done</a>
          </div>
          {sent && (
            <p className="message">Thanks. We&apos;ll check your report and add the device to the supported list once it passes.</p>
          )}
          {sendFailed && <p className="message error">Could not send. Copy the report instead.</p>}
        </>
      )}

      {error && <p className="message error">{error}</p>}
      <Footer />
    </main>
  );
}
