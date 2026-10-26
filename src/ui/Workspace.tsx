import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { exportAutoEq, parseAutoEq } from '../core/autoeq';
import type { EqBand, EqProfile, FilterType, Range } from '../core/eq';
import { exportFiioXml, parseFiioXml } from '../core/fiioXml';
import { fitProfile } from '../core/fit';
import { isFlat, matchSlotNames, parseSlotNames, renameSlot, serializeSlotNames, type SlotNames } from '../core/slotNames';
import { commitNumber, inRange, parseDecimal, stepValue } from '../core/step';
import type { DeviceAdapter } from '../devices/types';
import { EqGraph } from './EqGraph';

const NAMES_KEY = 'ozy-slot-names';
const GAIN_STEPS = [-1, -0.5, 0.5, 1];

type Notice =
  | { kind: 'info' | 'ok' | 'error' | 'busy'; text: string; undo?: () => void }
  | { kind: 'confirm'; text: string; go: () => void }
  | null;

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function parseAny(text: string, fileName: string, a: DeviceAdapter) {
  const isXml = /\.xml$/i.test(fileName) || text.trimStart().startsWith('<');
  const parsed = isXml ? parseFiioXml(text) : parseAutoEq(text);
  if (!parsed.ok) return { ok: false as const, errors: parsed.errors.map((e) => e.message) };
  const fit = fitProfile(parsed.profile, a.capabilities);
  if (!fit.ok) return { ok: false as const, errors: fit.errors.map((e) => e.message) };
  return { ok: true as const, profile: fit.profile, name: parsed.name, notes: fit.notes };
}

export function Stripes() {
  return <span className="stripes" aria-hidden><i /><i /><i /></span>;
}

function NumField({ value, step, range, unit, label, resetKey, onCommit, onBlocked }: {
  value: number; step: number; range: Range; unit: string; label: string; resetKey: string;
  onCommit: (v: number) => void; onBlocked: (blocked: boolean) => void;
}) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const lastReset = useRef(resetKey);
  const tip = `${label}: ${range.min} to ${range.max} ${unit}, step ${step}`;

  // Resync from the model on step buttons, arrow keys, undo or slot change.
  useEffect(() => {
    const reset = lastReset.current !== resetKey;
    lastReset.current = resetKey;
    if (reset || parseDecimal(text) !== value) {
      setText(String(value));
      setError(null);
      onBlocked(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, resetKey]);

  const typing = (t: string) => {
    setText(t);
    setError(null);
    const n = parseDecimal(t);
    if (inRange(n, range)) {
      onBlocked(false);
      if (n !== value) onCommit(n);
    } else onBlocked(true);
  };

  const finish = () => {
    const c = commitNumber(text, step, range);
    if (!c.ok) {
      setError(c.message);
      onBlocked(true);
      return;
    }
    setError(null);
    onBlocked(false);
    setText(String(c.value));
    if (c.value !== value) onCommit(c.value);
  };

  return (
    <span className="numfield">
      <input
        className={`num${error ? ' num-error' : ''}`}
        type="text"
        inputMode="decimal"
        value={text}
        title={tip}
        aria-label={tip}
        aria-invalid={error !== null}
        onChange={(e) => typing(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === 'Enter') return finish();
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          const base = parseDecimal(text) ?? value;
          onCommit(stepValue(base, step, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey, range));
        }}
      />
      {error && <span className="field-error" role="alert">{error}</span>}
    </span>
  );
}

export function Workspace({ adapter }: { adapter: DeviceAdapter }) {
  const product = adapter.info.productName;
  const cap = adapter.capabilities;
  const userSlots = cap.slots.filter((s) => s.writable);
  const [profiles, setProfiles] = useState<Record<number, EqProfile>>({});
  const [active, setActive] = useState<number | null>(null);
  const [selected, setSelected] = useState(userSlots[0]?.id ?? 0);
  const [draft, setDraft] = useState<EqProfile | null>(null);
  const [names, setNames] = useState<SlotNames>(() => parseSlotNames(localStorage.getItem(NAMES_KEY)));
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [blocked, setBlocked] = useState<Record<string, boolean>>({});
  const [undoCount, setUndoCount] = useState(0);
  const [compareId, setCompareId] = useState<number | null>(null);
  const [lastWrite, setLastWrite] = useState<{ id: number; profile: EqProfile; name: string } | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const lastOn = useRef<number>(userSlots[0]?.id ?? 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  const saved = profiles[selected];
  const shown = draft ?? saved;
  const matched = useMemo(() => matchSlotNames(names[product] ?? [], profiles), [names, product, profiles]);
  const slotName = (id: number) => matched[id] ?? '';
  const index = (id: number) => String(userSlots.findIndex((s) => s.id === id) + 1).padStart(2, '0');
  const cmpId = compareId !== null && compareId !== selected && profiles[compareId] ? compareId : null;
  const compare = cmpId !== null ? { profile: profiles[cmpId] as EqProfile, label: slotName(cmpId) || `Slot ${index(cmpId)}` } : undefined;
  const resetKey = `${selected}:${undoCount}`;
  const anyBlocked = Object.values(blocked).some(Boolean);
  const setBlk = (k: string) => (b: boolean) => setBlocked((o) => (o[k] === b ? o : { ...o, [k]: b }));
  const eqOff = cap.eqOffSlotId !== null && active === cap.eqOffSlotId;

  const updateNames = (f: (prev: SlotNames) => SlotNames) =>
    setNames((prev) => {
      const next = f(prev);
      localStorage.setItem(NAMES_KEY, serializeSlotNames(next));
      return next;
    });

  const run = useCallback(async (label: string, fn: () => Promise<string | { text: string; undo: () => void }>) => {
    setBusy(true);
    setNotice({ kind: 'busy', text: label });
    try {
      const r = await fn();
      setNotice(typeof r === 'string' ? { kind: 'ok', text: r } : { kind: 'ok', text: r.text, undo: r.undo });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void run('Reading slots from the device...', async () => {
      const a = await adapter.getActiveSlot();
      setActive(a);
      if (userSlots.some((s) => s.id === a)) lastOn.current = a;
      for (const s of userSlots) {
        const p = await adapter.readSlot(s.id);
        setProfiles((all) => ({ ...all, [s.id]: p }));
      }
      return 'Slots read.';
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter]);

  useEffect(() => {
    if (notice?.kind !== 'ok' && notice?.kind !== 'info') return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const writeProfile = (id: number, profile: EqProfile, extra = '', name = slotName(id), isUndo = false) =>
    run(`Writing slot ${index(id)} and verifying...`, async () => {
      const before = profiles[id] ? { id, profile: profiles[id], name: slotName(id) } : null;
      const back = await adapter.writeSlot(id, profile);
      setProfiles((all) => ({ ...all, [id]: back }));
      updateNames((n) => renameSlot(n, product, id, back, name));
      if (id === selected) setDraft(null);
      if (isUndo) {
        setLastWrite(null);
        return `Slot ${Number(index(id))} restored and verified.`;
      }
      setLastWrite(before);
      const text = `Slot ${Number(index(id))} saved and verified.${extra}`;
      return before ? { text, undo: () => void writeProfile(before.id, before.profile, '', before.name, true) } : text;
    });

  const requestWrite = (id: number, profile: EqProfile, extra = '', name = slotName(id)) => {
    const existing = profiles[id];
    const go = () => void writeProfile(id, profile, extra, name);
    if (existing && !isFlat(existing)) {
      const label = slotName(id) ? ` (${slotName(id)})` : '';
      setNotice({ kind: 'confirm', text: `Overwrite slot ${index(id)}${label}? Its current EQ on the device will be replaced.`, go });
    } else go();
  };

  const importText = (id: number, text: string, fileName: string) => {
    const r = parseAny(text, fileName, adapter);
    if (!r.ok) {
      setNotice({ kind: 'error', text: r.errors.join(' ') });
      return;
    }
    setSelected(id);
    setDraft(null);
    requestWrite(id, r.profile, r.notes.length ? ` ${r.notes.join(' ')}` : '', slotName(id) || r.name || '');
  };

  const importFile = async (id: number, file: File) => importText(id, await file.text(), file.name);

  // Latest handlers for window-level listeners.
  const latest = useRef({ busy, selected, importText });
  latest.current = { busy, selected, importText };

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: globalThis.DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
    const enter = (e: globalThis.DragEvent) => { if (hasFiles(e)) { depth++; setDragging(true); } };
    const leave = (e: globalThis.DragEvent) => { if (hasFiles(e) && --depth <= 0) { depth = 0; setDragging(false); setDragOver(null); } };
    const over = (e: globalThis.DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e: globalThis.DragEvent) => { if (hasFiles(e)) e.preventDefault(); depth = 0; setDragging(false); setDragOver(null); };
    const paste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      const text = e.clipboardData?.getData('text');
      if (text && !latest.current.busy) latest.current.importText(latest.current.selected, text, 'paste.txt');
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, []);

  const onDrop = (id: number) => (e: DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && !busy) void importFile(id, f);
  };

  const pasteButton = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return setNotice({ kind: 'error', text: 'The clipboard is empty. Copy the EQ text first.' });
      importText(selected, text, 'paste.txt');
    } catch {
      setNotice({ kind: 'error', text: 'The browser blocked clipboard access. Click the page, then press Ctrl/Cmd+V instead.' });
    }
  };

  const toggleEq = () =>
    run(eqOff ? 'Turning EQ on...' : 'Turning EQ off...', async () => {
      if (cap.eqOffSlotId === null) return 'This device cannot turn EQ off.';
      const target = eqOff ? lastOn.current : cap.eqOffSlotId;
      if (!eqOff && active !== null) lastOn.current = active;
      await adapter.setActiveSlot(target);
      setActive(target);
      return eqOff ? 'EQ is on.' : 'EQ is off (bypassed). The device plays without any EQ.';
    });

  const setBand = (i: number, patch: Partial<EqBand>) => {
    if (!shown) return;
    setDraft({ ...shown, bands: shown.bands.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  };
  const num = (v: string, fallback: number) => (v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);
  const nudgeGain = (i: number, delta: number) => {
    const b = shown?.bands[i];
    if (!b) return;
    setBand(i, { gain: Math.min(cap.gain.max, Math.max(cap.gain.min, Number((b.gain + delta).toFixed(1)))) });
  };

  const writeDraft = () => {
    if (!draft) return;
    const fit = fitProfile(draft, cap);
    if (!fit.ok) return setNotice({ kind: 'error', text: fit.errors.map((e) => e.message).join(' ') });
    requestWrite(selected, fit.profile, fit.notes.length ? ` ${fit.notes.join(' ')}` : '');
  };

  const fileBase = slotName(selected) || `${product} slot ${Number(index(selected))}`;
  const sel = index(selected);

  return (
    <div className={`workspace${dragging ? ' is-dragging' : ''}`}>
      <div className="sticky">
        <header className="hud">
          <span className="hud-dot" />
          <span className="hud-title">{product}</span>
          <span className="hud-item mono">Firmware {adapter.info.firmware ?? 'n/a'}</span>
          <span className="hud-item mono">
            Playing: {active === null ? '--' : userSlots.some((s) => s.id === active) ? `slot ${index(active)}` : eqOff ? 'EQ off' : 'built-in preset'}
          </span>
          <span className="switch-wrap" title="Off = bypass, the DAC plays without EQ">
            <span className="switch-label" id="eq-switch-label">EQ</span>
            <button
              role="switch"
              aria-checked={!eqOff}
              aria-labelledby="eq-switch-label"
              className={`switch${eqOff ? '' : ' switch-on'}`}
              disabled={busy || active === null}
              onClick={toggleEq}
            >
              <span className="switch-state">{eqOff ? 'OFF' : 'ON'}</span>
              <span className="switch-knob" />
            </button>
          </span>
        </header>
        {notice && (
          <div className={`notice notice-${notice.kind}`} role={notice.kind === 'error' || notice.kind === 'confirm' ? 'alert' : 'status'}>
            {notice.kind === 'busy' && <Stripes />}
            <span className="notice-text">{notice.text}</span>
            {notice.kind === 'confirm' && (
              <>
                <button className="btn-danger" autoFocus onClick={() => { const g = notice.go; setNotice(null); g(); }}>Yes, overwrite</button>
                <button className="btn-secondary" onClick={() => setNotice(null)}>Cancel</button>
              </>
            )}
            {notice.kind === 'ok' && notice.undo && <button className="btn-secondary" disabled={busy} onClick={notice.undo}>Undo</button>}
            {notice.kind === 'error' && <button className="btn-secondary" onClick={() => setNotice(null)}>Dismiss</button>}
          </div>
        )}
      </div>

      <section className="help">
        <h2 className="section-title">How to load an EQ</h2>
        <ol>
          <li>Pick a slot below (click it).</li>
          <li>Drag a file onto the slot, or use <strong>Choose file</strong>. Accepted: <strong>.txt</strong> (Squiglink / AutoEQ / REW parametric) or <strong>.xml</strong> (FiiO).</li>
          <li>Or copy EQ text to your clipboard, select a slot, then press <strong>Ctrl/Cmd+V</strong> (or click <strong>Paste from clipboard</strong>).</li>
        </ol>
      </section>

      <h2 className="section-title">EQ slots</h2>
      <div className="slot-grid">
        {userSlots.map((s) => {
          const p = profiles[s.id];
          return (
            <div
              key={s.id}
              className={`slot${s.id === active ? ' slot-active' : ''}${s.id === selected ? ' slot-selected' : ''}${dragOver === s.id ? ' slot-drop' : ''}${s.id === cmpId ? ' slot-compare' : ''}`}
              onClick={() => { setSelected(s.id); setCompareId((c) => (c === s.id ? null : c)); setDraft(null); setBlocked({}); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(s.id); }}
              onDragLeave={() => setDragOver((o) => (o === s.id ? null : o))}
              onDrop={onDrop(s.id)}
            >
              <div className="slot-head">
                <span className="tag mono">{index(s.id)}</span>
                <input
                  className="slot-name"
                  placeholder={s.label}
                  value={slotName(s.id)}
                  disabled={!p}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => p && updateNames((n) => renameSlot(n, product, s.id, p, e.target.value))}
                  aria-label={`Name for slot ${index(s.id)}`}
                />
                {s.id === active && <span className="badge-active"><i />ACTIVE</span>}
                {s.id === cmpId && <span className="badge-compare">COMPARE</span>}
              </div>
              {p ? <EqGraph profile={p} thumb /> : <div className="graph graph-thumb" />}
              <div className="mono caption">
                {p ? `${p.bands.filter((b) => b.enabled && b.gain !== 0).length} bands · ${p.preamp.toFixed(1)} dB` : '...'}
              </div>
              <div className="slot-actions">
              <button
                className="btn-secondary"
                aria-pressed={s.id === cmpId}
                disabled={!p || s.id === selected}
                title="Overlay this slot's curve on the main graph"
                onClick={(e) => { e.stopPropagation(); setCompareId((c) => (c === s.id ? null : s.id)); }}
              >Compare</button>
              <button
                className="btn-secondary"
                disabled={busy || !p || active === s.id}
                title="Make the device play this slot's EQ"
                onClick={(e) => {
                  e.stopPropagation();
                  void run(`Switching to slot ${index(s.id)}...`, async () => {
                    await adapter.setActiveSlot(s.id);
                    setActive(s.id);
                    lastOn.current = s.id;
                    return `Now playing slot ${index(s.id)}.`;
                  });
                }}
              >Activate</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="actions">
        <section className="action-group">
          <h3 className="label">Import into slot {sel}</h3>
          <div className="bar">
            <button className="btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>Choose file (.txt / .xml)</button>
            <button className="btn-secondary" disabled={busy} onClick={() => void pasteButton()}>Paste from clipboard</button>
            {lastWrite && <button className="btn-secondary" disabled={busy} onClick={() => void writeProfile(lastWrite.id, lastWrite.profile, '', lastWrite.name, true)}>Undo last write (slot {index(lastWrite.id)})</button>}
          </div>
        </section>
        <section className="action-group">
          <h3 className="label">Download slot {sel} as file</h3>
          <div className="bar">
            <button className="btn-secondary" disabled={!shown} onClick={() => shown && download(`${fileBase}.txt`, exportAutoEq(shown, { omitFlat: true }), 'text/plain')}>Download .txt (Squiglink / AutoEQ)</button>
            <button className="btn-secondary" disabled={!shown} onClick={() => shown && download(`${fileBase}.xml`, exportFiioXml(shown, { model: product, name: slotName(selected) || undefined }), 'application/xml')}>Download .xml (FiiO)</button>
          </div>
        </section>
        <section className="action-group">
          <h3 className="label">Slot names</h3>
          <div className="bar">
            <button className="btn-secondary" title="Saves only the slot names (kept in this browser) to a file. It does not save any EQ settings." onClick={() => download('ozybridge-slot-names.json', serializeSlotNames(names), 'application/json')}>Save slot names to file</button>
            <button className="btn-secondary" title="Loads slot names from a file saved earlier. Names only, no EQ settings are written to the device." onClick={() => restoreRef.current?.click()}>Load slot names from file</button>
          </div>
        </section>
        <input ref={fileRef} type="file" accept=".txt,.xml" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(selected, f); }} />
        <input ref={restoreRef} type="file" accept=".json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { const parsed = parseSlotNames(await f.text()); updateNames(() => parsed); } }} />
      </div>

      {shown && (
        <section className="eq-view">
          <h2 className="section-title">Slot {sel} {slotName(selected)}</h2>
          <EqGraph profile={shown} label={slotName(selected) || `Slot ${sel}`} compare={compare} />
          <div className="preamp">
            <label className="label">Preamp</label>
            <NumField label="Preamp" unit="dB" value={shown.preamp} step={cap.step.gain} range={cap.preamp} resetKey={resetKey} onBlocked={setBlk('preamp')} onCommit={(v) => setDraft({ ...shown, preamp: v })} />
            <span className="unit">dB</span>
            <span className="hint">Tip: click a field, then use the arrow keys (Shift = 10x).</span>
          </div>
          <table className="bands">
            <thead><tr><th>#</th><th>Type</th><th>Freq (Hz)</th><th>Gain (dB)</th><th>Q</th></tr></thead>
            <tbody>
              {shown.bands.map((b, i) => (
                <tr key={i}>
                  <td className="mono">{String(i + 1).padStart(2, '0')}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bar">
            <button className="btn-primary" disabled={!draft || busy || anyBlocked} title="Send these edits to the device and verify them" onClick={writeDraft}>Save changes to slot {sel}</button>
            {anyBlocked && <span className="field-error">Fix the highlighted number fields before saving.</span>}
            <button className="btn-secondary" disabled={!draft} title="Throw away unsaved edits and show what is currently on the device" onClick={() => { setDraft(null); setBlocked({}); setUndoCount((n) => n + 1); }}>Undo changes</button>
          </div>
        </section>
      )}

      {dragging && <div className="drop-overlay" aria-hidden><span>Drop on a slot to load it</span></div>}
    </div>
  );
}
