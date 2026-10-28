import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { EqBand, EqLimits, EqProfile, FilterType } from '../core/eq';
import { clipCheck } from '../core/fit';
import { addBandAt, deleteBand, isUnused, nextAddIndex, usedCount } from '../core/graphEdit';
import { GRAPH_PALETTES } from './graphPalettes';
import { AutoEqPanel } from './AutoEqPanel';
import { EqGraph } from './EqGraph';
import { GraphKeysLegend } from './GraphKeysLegend';
import { MeasurementPicker, type OverlayMeasurement } from './MeasurementPicker';
import { NumField } from './NumField';
import { TargetToggles, type TargetOverlay } from './TargetToggles';

const GAIN_STEPS = [-1, -0.5, 0.5, 1];

type ChangeOpts = { coalesceKey?: string; skipPush?: boolean };

function EqPanelHeader({ index, title }: { index?: string; title: string }) {
  return (
    <>
      <header className="eq-panel__head">
        {index && <span className="eq-panel__index">{index}</span>}
        <span className="eq-panel__title">{title}</span>
      </header>
      <div className="eq-panel__rule" aria-hidden />
    </>
  );
}

export function EqEditor({
  heading, profile: shown, limits: cap, resetKey, label, compare, sweep,
  onChange, onEditStart, onEditEnd, onUndo, onRedo, onNotice, onBlockedChange, exportBar, targetAside, bandsHead, onAutoName, children,
}: {
  heading: ReactNode;
  profile: EqProfile;
  limits: EqLimits;
  resetKey: string;
  label: string;
  compare?: { profile: EqProfile; label: string };
  sweep?: number;
  onChange: (next: EqProfile, opts?: ChangeOpts) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onNotice: (text: string) => void;
  onBlockedChange: (blocked: boolean) => void;
  exportBar?: ReactNode;
  targetAside?: ReactNode;
  bandsHead?: ReactNode;
  onAutoName?: (name: string) => void;
  children?: ReactNode;
}) {
  const [selectedBand, setSelectedBand] = useState<number | null>(null);
  const [opened, setOpened] = useState<number[]>([]);
  const [blocked, setBlocked] = useState<Record<string, boolean>>({});
  const [iemColors, setIemColors] = useState<readonly string[]>(() => GRAPH_PALETTES.dark[0]?.iem ?? ['#EB8D00', '#00EB5E', '#DA47FF']);
  const [overlays, setOverlays] = useState<OverlayMeasurement[]>([]);
  const [targets, setTargets] = useState<TargetOverlay[]>([]);
  const eqViewRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setSelectedBand(null);
    setOpened([]);
    setBlocked({});
  }, [resetKey]);

  const anyBlocked = Object.values(blocked).some(Boolean);
  const blockedCb = useRef(onBlockedChange);
  blockedCb.current = onBlockedChange;
  useEffect(() => {
    blockedCb.current(anyBlocked);
  }, [anyBlocked]);

  useEffect(() => {
    const root = eqViewRef.current;
    if (!root) return;
    const onKey = (ev: KeyboardEvent) => {
      if (!root.contains(document.activeElement)) return;
      const t = ev.target as HTMLElement | null;
      if (!t || t.closest('input, select, textarea')) return;
      const mod = ev.metaKey || ev.ctrlKey;
      if (mod && ev.key.toLowerCase() === 'z' && !ev.altKey) {
        ev.preventDefault();
        if (ev.shiftKey) onRedo();
        else onUndo();
      } else if (mod && ev.key.toLowerCase() === 'y') {
        ev.preventDefault();
        onRedo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onUndo, onRedo]);

  const graphCap = useMemo(
    () => ({ freq: cap.freq, gain: cap.gain, q: cap.q, step: cap.step, maxBands: cap.maxBands }),
    [cap],
  );
  const clip = useMemo(() => clipCheck(shown, cap), [shown, cap]);
  const setBlk = (k: string) => (b: boolean) => setBlocked((o) => (o[k] === b ? o : { ...o, [k]: b }));

  const setBand = (i: number, patch: Partial<EqBand>, opts?: ChangeOpts) => {
    onChange({ ...shown, bands: shown.bands.map((b, j) => (j === i ? { ...b, ...patch } : b)) }, opts);
  };

  const addBandSlot = () => {
    const idx = nextAddIndex(shown, opened);
    if (idx === null) {
      onNotice(`All ${cap.maxBands} bands are in use. Delete one first.`);
      return;
    }
    setOpened((o) => [...o, idx]);
    setSelectedBand(idx);
    onChange({
      ...shown,
      bands: shown.bands.map((b, i) => (i === idx ? { ...b, type: 'PK', enabled: true, gain: 0 } : b)),
    });
  };

  const removeBand = (i: number) => {
    onChange(deleteBand(shown, i));
    setOpened((o) => o.filter((x) => x !== i));
    if (selectedBand === i) setSelectedBand(null);
  };
  const nudgeGain = (i: number, delta: number) => {
    const b = shown.bands[i];
    if (!b) return;
    setBand(i, { gain: Math.min(cap.gain.max, Math.max(cap.gain.min, Number((b.gain + delta).toFixed(1)))) });
  };

  const addSlot = nextAddIndex(shown, opened);

  return (
    <section className="eq-view" ref={eqViewRef}>
      <h2 className="section-title">{heading}</h2>
      <EqGraph
        profile={shown}
        label={label}
        compare={compare}
        measurements={overlays}
        targets={targets}
        sweep={sweep}
        hintId="eq-graph-keys"
        onNotice={onNotice}
        onColors={setIemColors}
        editable={{
          selected: selectedBand,
          onSelect: setSelectedBand,
          onEditStart,
          onEditEnd,
          onChange: (i, patch, meta) => setBand(i, patch, meta),
          onAdd: (freq, gain, meta) => {
            // Opened 0 dB slots are still "unused". Mask them so a graph add does not overwrite one.
            const masked = {
              ...shown,
              bands: shown.bands.map((b, i) => (opened.includes(i) && isUnused(b) ? { ...b, gain: 1 } : b)),
            };
            const r = addBandAt(masked, freq, gain, graphCap);
            if (!r) return null;
            const bands = r.profile.bands.map((b, i) => (i === r.index ? b : shown.bands[i]!));
            onChange({ ...r.profile, bands }, meta);
            setOpened((o) => (o.includes(r.index) ? o : [...o, r.index]));
            return r.index;
          },
          onDelete: removeBand,
          cap: graphCap,
          filterTypes: cap.filterTypes,
        }}
      />
      <div className="target-row">
        <TargetToggles onChange={setTargets} />
        {targetAside}
      </div>
      <GraphKeysLegend id="eq-graph-keys" filterTypes={cap.filterTypes} />
      <div className="eq-panels">
        <section className="eq-panel">
          <EqPanelHeader index="01" title="Add IEM/headphone measurement" />
          <MeasurementPicker items={overlays} iemColors={iemColors} onChange={setOverlays} onNotice={onNotice} />
        </section>
        <section className="eq-panel">
          <EqPanelHeader index="02" title="Match" />
          <AutoEqPanel
            measurements={overlays}
            limits={cap}
            onApply={(profile, generatedName) => {
              onEditStart();
              onChange(profile);
              onEditEnd();
              if (generatedName) onAutoName?.(generatedName);
            }}
            onNotice={onNotice}
          />
          {exportBar}
        </section>
        <section className="eq-panel eq-panel--bands">
          <EqPanelHeader index="03" title="Bands" />
          {bandsHead}
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {selectedBand !== null && shown.bands[selectedBand]
              ? `Band ${String(selectedBand + 1).padStart(2, '0')}: ${shown.bands[selectedBand].freq} Hz, ${shown.bands[selectedBand].gain >= 0 ? '+' : ''}${shown.bands[selectedBand].gain.toFixed(1)} dB, Q ${shown.bands[selectedBand].q}`
              : ''}
          </p>
          <div className="preamp">
            <label className="label">Preamp</label>
            <NumField label="Preamp" unit="dB" value={shown.preamp} step={cap.step.gain} range={cap.preamp} resetKey={resetKey} onBlocked={setBlk('preamp')} onCommit={(v) => onChange({ ...shown, preamp: v })} />
            <span className="unit">dB</span>
            <span className="hint">Tip: drag along the curve to add a band, drag points to edit. See Graph shortcuts for more.</span>
          </div>
          {clip && (
            <div className="clip-warn" role="status">
              <span>{clip.message}</span>
              <button className="btn-secondary" onClick={() => onChange({ ...shown, preamp: clip.suggested })}>Set preamp to {clip.suggested.toFixed(1)} dB</button>
            </div>
          )}
          <div className="bands-scroll"><table className="bands">
            <thead><tr><th>#</th><th>Type</th><th>Freq (Hz)</th><th>Gain (dB)</th><th>Q</th><th aria-label="Delete band" /></tr></thead>
            <tbody>
              {shown.bands.map((b, i) => {
                if (isUnused(b) && !opened.includes(i) && selectedBand !== i) return null;
                const nn = String(i + 1).padStart(2, '0');
                return (
                <tr
                  key={i}
                  className={selectedBand === i ? 'band-selected' : undefined}
                  onClick={() => setSelectedBand(i)}
                >
                  <td className="mono">{nn}</td>
                  <td>
                    <select value={b.type} onChange={(e) => setBand(i, { type: e.target.value as FilterType })}>
                      {cap.filterTypes.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td><NumField label="Frequency" unit="Hz" value={b.freq} step={cap.step.freq} range={cap.freq} resetKey={resetKey} onBlocked={setBlk(`${i}-freq`)} onCommit={(v) => setBand(i, { freq: v })} /></td>
                  <td className="gain-cell">
                    <NumField label="Gain" unit="dB" value={b.gain} step={cap.step.gain} range={cap.gain} resetKey={resetKey} onBlocked={setBlk(`${i}-gain`)} onCommit={(v) => setBand(i, { gain: v })} />
                    {GAIN_STEPS.map((d) => (
                      <button key={d} className="step" title={`${d > 0 ? 'Raise' : 'Lower'} band ${i + 1} gain by ${Math.abs(d)} dB`} onClick={() => nudgeGain(i, d)}>{d > 0 ? `+${d}` : d}</button>
                    ))}
                  </td>
                  <td><NumField label="Q" unit="" value={b.q} step={cap.step.q} range={cap.q} resetKey={resetKey} onBlocked={setBlk(`${i}-q`)} onCommit={(v) => setBand(i, { q: v })} /></td>
                  <td>
                    <button
                      type="button"
                      className="band-delete"
                      aria-label={`Delete band ${nn}`}
                      title={`Delete band ${nn}`}
                      onClick={(e) => { e.stopPropagation(); removeBand(i); }}
                    >×</button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table></div>
          <div className="bands-foot bar">
            <button type="button" className="btn-secondary" disabled={addSlot === null} onClick={addBandSlot}>+ Add band</button>
            <span className="hint">{usedCount(shown)} of {cap.maxBands} bands used</span>
          </div>
          {children}
        </section>
      </div>
    </section>
  );
}
