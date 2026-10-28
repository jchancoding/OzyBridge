import { useEffect, useMemo, useState } from 'react';
import type { EqLimits, EqProfile } from '../core/eq';
import { fitAutoEq } from '../core/autoEqFit';
import { TARGETS } from '../core/targets';
import { autoEqName } from './autoEqName';
import { loadTarget } from './TargetToggles';
import type { OverlayMeasurement } from './MeasurementPicker';

function enabledBandCount(profile: EqProfile): number {
  return profile.bands.filter((b) => b.enabled && b.gain !== 0).length;
}

function WrapPick({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);
  return (
    <div className="wrap-pick">
      <span className="label">{label}</span>
      <button
        type="button"
        className="wrap-pick__value"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {current?.label ?? placeholder}
      </button>
      {open && (
        <ul className="wrap-pick__list" role="listbox" aria-label={label}>
          <li>
            <button type="button" className="wrap-pick__option" onClick={() => { onChange(''); setOpen(false); }}>{placeholder}</button>
          </li>
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="wrap-pick__option"
                aria-selected={o.id === value}
                onClick={() => { onChange(o.id); setOpen(false); }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AutoEqPanel({
  measurements,
  limits,
  onApply,
  onNotice,
}: {
  measurements: OverlayMeasurement[];
  limits: EqLimits;
  onApply: (profile: EqProfile, name: string) => void;
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

  useEffect(() => {
    if (fromId && !measurements.some((m) => m.id === fromId)) setFromId('');
    if (toId && !measurements.some((m) => m.id === toId) && !TARGETS.some((t) => t.id === toId)) setToId('');
  }, [measurements, fromId, toId]);

  const samePair = fromId !== '' && toId !== '' && fromId === toId;
  const canFit = !busy && !!fromItem && (!!toOverlay || !!toTarget) && !samePair;

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
      const toLabel = toOverlay?.label ?? toTarget?.name ?? '';
      const name = autoEqName(fromItem.label, toLabel);
      onApply(result.profile, name);
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
      <WrapPick
        label="From"
        value={fromId}
        placeholder="Select…"
        options={measurements.map((m) => ({ id: m.id, label: m.label }))}
        onChange={(id) => {
          setFromId(id);
          if (id === toId) setToId('');
        }}
      />
      <WrapPick
        label="To"
        value={toId}
        placeholder="Select…"
        options={toOptions.map((o) => ({ id: o.id, label: o.label }))}
        onChange={setToId}
      />
      <div className="auto-eq__actions bar">
        <button type="button" className="btn-secondary" disabled={!canFit || limits.maxBands < 5} onClick={() => void runFit(5)}>
          5 band AutoEQ
        </button>
        <button type="button" className="btn-secondary" disabled={!canFit || limits.maxBands < 10} onClick={() => void runFit(10)}>
          10 band AutoEQ
        </button>
      </div>
      {limits.maxBands < 10 && (
        <p className="hint">This device has {limits.maxBands} bands.</p>
      )}
      {samePair && (
        <p className="hint">Pick a different From and To.</p>
      )}
    </div>
  );
}
