import { useMemo, useState } from 'react';
import type { EqLimits, EqProfile } from '../core/eq';
import { fitAutoEq } from '../core/autoEqFit';
import { TARGETS } from '../core/targets';
import { loadTarget } from './TargetToggles';
import type { OverlayMeasurement } from './MeasurementPicker';

function enabledBandCount(profile: EqProfile): number {
  return profile.bands.filter((b) => b.enabled && b.gain !== 0).length;
}

export function AutoEqPanel({
  measurements,
  limits,
  onApply,
  onNotice,
}: {
  measurements: OverlayMeasurement[];
  limits: EqLimits;
  onApply: (profile: EqProfile) => void;
  onNotice: (text: string) => void;
}) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [busy, setBusy] = useState(false);

  const fromItem = measurements.find((m) => m.id === fromId);
  const toOverlay = measurements.find((m) => m.id === toId);
  const toTarget = TARGETS.find((t) => t.id === toId);

  const toOptions = useMemo(() => {
    const iem = measurements.filter((m) => m.id !== fromId);
    return [
      ...iem.map((m) => ({ id: m.id, label: m.label, kind: 'iem' as const })),
      ...TARGETS.map((t) => ({ id: t.id, label: t.name, kind: 'target' as const })),
    ];
  }, [measurements, fromId]);

  const samePair = fromId !== '' && toId !== '' && fromId === toId;
  const missingEnds = !fromId || !toId;
  const canFit = !busy && !missingEnds && !samePair && measurements.length > 0;

  async function runFit(bandCount: number) {
    if (!fromItem || (!toOverlay && !toTarget)) return;
    setBusy(true);
    try {
      let target = toOverlay?.measurement;
      if (toTarget) target = await loadTarget(toTarget);
      if (!target) {
        onNotice('Could not load the target curve.');
        return;
      }
      const result = fitAutoEq({
        source: fromItem.measurement,
        target,
        bandCount,
        limits,
      });
      onApply(result.profile);
      onNotice(`Matched with ${enabledBandCount(result.profile)} bands. About ${result.errorDb.toFixed(1)} dB off.`);
    } catch {
      onNotice('Auto match failed. Try another pair or fewer bands.');
    } finally {
      setBusy(false);
    }
  }

  if (measurements.length === 0) {
    return (
      <div className="auto-eq">
        <p className="hint">Match an IEM to another IEM or a target. This replaces the bands. Undo brings them back.</p>
        <p className="hint">Add an IEM above first.</p>
      </div>
    );
  }

  return (
    <div className="auto-eq">
      <p className="hint">Match an IEM to another IEM or a target. This replaces the bands. Undo brings them back.</p>
      <div className="auto-eq__row">
        <label className="label" htmlFor="auto-eq-from">From</label>
        <select
          id="auto-eq-from"
          value={fromId}
          onChange={(e) => {
            setFromId(e.target.value);
            if (e.target.value === toId) setToId('');
          }}
        >
          <option value="">Select…</option>
          {measurements.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>
      <div className="auto-eq__row">
        <label className="label" htmlFor="auto-eq-to">To</label>
        <select id="auto-eq-to" value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">Select…</option>
          {toOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="auto-eq__actions bar">
        <button type="button" className="btn-secondary" disabled={!canFit || limits.maxBands < 5} onClick={() => void runFit(5)}>
          5 bands
        </button>
        <button type="button" className="btn-secondary" disabled={!canFit || limits.maxBands < 10} onClick={() => void runFit(10)}>
          10 bands
        </button>
      </div>
      {limits.maxBands < 10 && (
        <p className="hint">This device has {limits.maxBands} bands.</p>
      )}
      {(missingEnds || samePair) && fromId && (
        <p className="hint">Pick a different From and To.</p>
      )}
    </div>
  );
}
