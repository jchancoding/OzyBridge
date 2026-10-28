import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { parseSlotBackup, planBackupImport, serializeSlotBackup, type RestoreItem } from '../core/backup';
import { exportAutoEq, parseAutoEq } from '../core/autoeq';
import type { EqProfile } from '../core/eq';
import { exportFiioXml, parseFiioXml } from '../core/fiioXml';
import { fitProfile } from '../core/fit';
import { decodeShareFragment, encodeShareFragment } from '../core/shareLink';
import { isFlat, matchSlotNames, parseSlotNames, renameSlot, serializeSlotNames, type SlotNames } from '../core/slotNames';
import { addPreset, deletePreset, mergePresets, parsePresets, renamePreset, serializePresets, type Preset } from '../core/presets';
import type { DeviceAdapter } from '../devices/types';
import { describeConnectError } from './connectMessages';
import { EqGraph } from './EqGraph';
import { download } from './download';
import { EqEditor } from './EqEditor';
import { useEqDraft } from './useEqDraft';
import './motion.css';
import { PresetLibrary, PRESET_DRAG_TYPE } from './PresetLibrary';

const NAMES_KEY = 'ozy-slot-names';
const PRESETS_KEY = 'ozy-presets';

type Notice =
  | { kind: 'info' | 'ok' | 'error' | 'busy'; text: string; undo?: () => void }
  | { kind: 'warn'; text: string; undo?: () => void }
  | { kind: 'confirm'; text: string; go: () => void; yes?: string; no?: string; danger?: boolean }
  | null;

function parseAny(text: string, fileName: string, a: DeviceAdapter) {
  const isXml = /\.xml$/i.test(fileName) || text.trimStart().startsWith('<');
  const parsed = isXml ? parseFiioXml(text) : parseAutoEq(text);
  if (!parsed.ok) return { ok: false as const, errors: parsed.errors.map((e) => e.message) };
  const fit = fitProfile(parsed.profile, a.capabilities);
  if (!fit.ok) return { ok: false as const, errors: fit.errors.map((e) => e.message) };
  return { ok: true as const, profile: fit.profile, name: parsed.name, notes: fit.notes, warnings: fit.warnings };
}

export function Stripes() {
  return <span className="stripes" aria-hidden><i /><i /><i /></span>;
}

export function Workspace({ adapter }: { adapter: DeviceAdapter }) {
  const product = adapter.info.productName;
  const cap = adapter.capabilities;
  const userSlots = cap.slots.filter((s) => s.writable);
  const [profiles, setProfiles] = useState<Record<number, EqProfile>>({});
  const [active, setActive] = useState<number | null>(null);
  const [selected, setSelected] = useState(userSlots[0]?.id ?? 0);
  const [names, setNames] = useState<SlotNames>(() => parseSlotNames(localStorage.getItem(NAMES_KEY)));
  const [presets, setPresets] = useState<Preset[]>(() => parsePresets(localStorage.getItem(PRESETS_KEY)));
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [anyBlocked, setAnyBlocked] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [compareId, setCompareId] = useState<number | null>(null);
  const [lastWrite, setLastWrite] = useState<{ id: number; profile: EqProfile; name: string } | null>(null);
  const [sweep, setSweep] = useState(0);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const lastOn = useRef<number>(userSlots[0]?.id ?? 0);
  const shared = useRef<ReturnType<typeof decodeShareFragment> | null>(location.hash ? decodeShareFragment(location.hash) : null);
  const [readDone, setReadDone] = useState(false);
  const [pending, setPending] = useState<{ name: string; profile: EqProfile; extra: string; warn: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);

  const saved = profiles[selected];
  const { draft, shown, canUndo, canRedo, clear: clearEdit, apply: applyEdit, beginDrag: beginDragEdit, endDrag: endDragEdit, undo: undoEdit, redo: redoEdit } = useEqDraft(saved);

  useEffect(() => {
    clearEdit();
  }, [selected, clearEdit]);

  const matched = useMemo(() => matchSlotNames(names[product] ?? [], profiles), [names, product, profiles]);
  const slotName = (id: number) => matched[id] ?? '';
  const index = (id: number) => String(userSlots.findIndex((s) => s.id === id) + 1).padStart(2, '0');
  const cmpId = compareId !== null && compareId !== selected && profiles[compareId] ? compareId : null;
  const compare = cmpId !== null ? { profile: profiles[cmpId] as EqProfile, label: slotName(cmpId) || `Slot ${index(cmpId)}` } : undefined;
  const allRead = userSlots.every((s) => profiles[s.id] !== undefined);
  const exportAll = () => {
    if (!allRead) return;
    const now = new Date();
    const text = serializeSlotBackup({
      product,
      exportedAt: now.toISOString(),
      slots: userSlots.map((s) => ({ id: s.id, label: s.label, name: slotName(s.id), profile: profiles[s.id] as EqProfile })),
    });
    download(`ozybridge-${product}-slots-${now.toISOString().slice(0, 10)}.json`, text, 'application/json');
  };
  const resetKey = `${selected}:${undoCount}`;
  const eqOff = cap.eqOffSlotId !== null && active === cap.eqOffSlotId;

  const updateNames = (f: (prev: SlotNames) => SlotNames) =>
    setNames((prev) => {
      const next = f(prev);
      localStorage.setItem(NAMES_KEY, serializeSlotNames(next));
      return next;
    });

  const updatePresets = (f: (prev: Preset[]) => Preset[]) =>
    setPresets((prev) => {
      const next = f(prev);
      localStorage.setItem(PRESETS_KEY, serializePresets(next));
      return next;
    });

  const run = useCallback(async (label: string, fn: () => Promise<string | { text: string; undo?: () => void; warn?: string }>) => {
    setBusy(true);
    setNotice({ kind: 'busy', text: label });
    try {
      const r = await fn();
      if (typeof r === 'string') setNotice({ kind: 'ok', text: r });
      else if (r.warn) setNotice({ kind: 'warn', text: `${r.text} ${r.warn}`, undo: r.undo });
      else setNotice({ kind: 'ok', text: r.text, undo: r.undo });
    } catch (e) {
      setNotice({ kind: 'error', text: describeConnectError(e) });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    setReadDone(false);
    void run('Reading slots from the device...', async () => {
      const a = await adapter.getActiveSlot();
      setActive(a);
      if (userSlots.some((s) => s.id === a)) lastOn.current = a;
      const put = (id: number, p: EqProfile) => setProfiles((all) => ({ ...all, [id]: p }));
      // The active slot reads without a switch, so it appears first.
      const ids = userSlots.map((s) => s.id).sort((x, y) => Number(y === a) - Number(x === a));
      if (adapter.readSlots) {
        await adapter.readSlots(ids, put);
      } else {
        for (const id of ids) put(id, await adapter.readSlot(id));
      }
      return 'Slots read.';
    }).then(() => setReadDone(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter]);

  useEffect(() => {
    const d = shared.current;
    if (!readDone || !d) return;
    // Keep the link in the address bar if the slot read failed, so a reload can retry it.
    if (userSlots.some((s) => profiles[s.id] === undefined)) return;
    shared.current = null;
    history.replaceState(null, '', location.pathname + location.search);
    if (!d.ok) return;
    const fit = fitProfile(d.profile, cap);
    if (!fit.ok) {
      setNotice({ kind: 'error', text: fit.errors.map((e) => e.message).join(' ') });
      return;
    }
    const target = userSlots.find((s) => profiles[s.id] && isFlat(profiles[s.id] as EqProfile)) ?? userSlots[0];
    if (target) setSelected(target.id);
    clearEdit();
    setPending({ name: d.name, profile: fit.profile, extra: fit.notes.length ? ` ${fit.notes.join(' ')}` : '', warn: fit.warnings.join(' ') });
    // Retries once the slot read has filled `profiles`. `shared` is cleared above so it runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readDone, profiles]);

  useEffect(() => {
    if (notice?.kind !== 'ok' && notice?.kind !== 'info') return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const writeProfile = (id: number, profile: EqProfile, extra = '', name = slotName(id), isUndo = false, warn = '') =>
    run(`Writing slot ${index(id)} and verifying...`, async () => {
      const before = profiles[id] ? { id, profile: profiles[id], name: slotName(id) } : null;
      const back = await adapter.writeSlot(id, profile);
      setProfiles((all) => ({ ...all, [id]: back }));
      if (!isUndo) setPending(null);
      setSweep((n) => n + 1);
      updateNames((n) => renameSlot(n, product, id, back, name));
      if (id === selected) clearEdit();
      if (isUndo) {
        setLastWrite(null);
        return `Slot ${Number(index(id))} restored and verified.`;
      }
      setLastWrite(before);
      const text = `Slot ${Number(index(id))} saved and verified.${extra}`;
      const undo = before ? () => void writeProfile(before.id, before.profile, '', before.name, true) : undefined;
      return warn || undo ? { text, undo, warn } : text;
    });

  const requestWrite = (id: number, profile: EqProfile, extra = '', name = slotName(id), warn = '') => {
    const existing = profiles[id];
    const go = () => void writeProfile(id, profile, extra, name, false, warn);
    if (existing && !isFlat(existing)) {
      const label = slotName(id) ? ` (${slotName(id)})` : '';
      setNotice({ kind: 'confirm', text: `Overwrite slot ${index(id)}${label}? Its current EQ on the device will be replaced.`, go });
    } else go();
  };

  const startRestore = (text: string): boolean => {
    const parsed = parseSlotBackup(text);
    if (!parsed.ok) return false;
    if (!allRead) {
      setNotice({ kind: 'error', text: 'Wait until all slots have been read from the device, then import the backup again.' });
      return true;
    }
    const plan = planBackupImport(parsed.backup, product, userSlots.map((s) => s.id), cap, profiles);
    if (!plan.ok) {
      setNotice({ kind: 'error', text: `Nothing was written. ${plan.errors.slice(0, 4).join(' ')}${plan.errors.length > 4 ? ` (and ${plan.errors.length - 4} more)` : ''}` });
      return true;
    }
    const todo = plan.items.filter((i) => i.changed);
    if (todo.length === 0) {
      updateNames((n) => plan.items.reduce((acc, i) => renameSlot(acc, product, i.id, i.profile, i.name), n));
      setNotice({ kind: 'ok', text: 'Every slot on the device already matches this backup. Slot names were updated.' });
      return true;
    }
    const slots = todo.map((i) => index(i.id)).join(', ');
    const secs = Math.ceil((todo.length * 4.5) / 5) * 5;
    setNotice({
      kind: 'confirm',
      text: `Restore ${todo.length} slot${todo.length === 1 ? '' : 's'} (${slots}) from a backup made ${parsed.backup.exportedAt.slice(0, 10)}? Their current EQs on the device will be replaced and cannot be undone. This takes about ${secs} seconds. Tip: use Export all slots first to keep what is there now.`,
      yes: 'Yes, restore',
      go: () => void restoreAll(plan.items),
    });
    return true;
  };

  const restoreAll = (items: RestoreItem[]) =>
    run('Restoring slots...', async () => {
      const todo = items.filter((i) => i.changed);
      let n = 0;
      for (const it of todo) {
        n++;
        setNotice({ kind: 'busy', text: `Restoring slot ${index(it.id)} (${n} of ${todo.length}) and verifying...` });
        const back = await adapter.writeSlot(it.id, it.profile);
        setProfiles((all) => ({ ...all, [it.id]: back }));
        updateNames((nm) => renameSlot(nm, product, it.id, back, it.name));
      }
      updateNames((nm) => items.filter((i) => !i.changed).reduce((acc, i) => renameSlot(acc, product, i.id, i.profile, i.name), nm));
      setActive(await adapter.getActiveSlot());
      clearEdit();
      setLastWrite(null);
      setSweep((k) => k + 1);
      const risky = items.filter((i) => i.warnings.length).map((i) => index(i.id));
      const warn = risky.length ? `Clipping risk in slot${risky.length === 1 ? '' : 's'} ${risky.join(', ')}: the preamp is higher than the boost allows. Select a slot to see the suggested preamp.` : '';
      return { text: `Restored ${todo.length} slot${todo.length === 1 ? '' : 's'} and verified each one.`, warn };
    });

  const importText = (id: number, text: string, fileName: string) => {
    if ((/\.json$/i.test(fileName) || text.trimStart().startsWith('{')) && startRestore(text)) return;
    const r = parseAny(text, fileName, adapter);
    if (!r.ok) {
      setNotice({ kind: 'error', text: r.errors.join(' ') });
      return;
    }
    setSelected(id);
    clearEdit();
    requestWrite(id, r.profile, r.notes.length ? ` ${r.notes.join(' ')}` : '', slotName(id) || r.name || '', r.warnings.join(' '));
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

  const writePreset = (slot: number, presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    const fit = fitProfile(preset.profile, cap);
    if (!fit.ok) return setNotice({ kind: 'error', text: fit.errors.map((e) => e.message).join(' ') });
    setSelected(slot);
    clearEdit();
    requestWrite(slot, fit.profile, fit.notes.length ? ` ${fit.notes.join(' ')}` : '', preset.name, fit.warnings.join(' '));
  };

  const savePreset = () => {
    if (!saved) return;
    const now = new Date();
    const name = slotName(selected) || `${product} slot ${Number(index(selected))}`;
    updatePresets((l) => addPreset(l, { id: crypto.randomUUID(), name, profile: saved, createdAt: now.toISOString(), source: product }));
    setNotice({ kind: 'ok', text: `Saved "${name}" to the preset library.` });
  };

  const loadPresets = (text: string) => {
    const incoming = parsePresets(text);
    if (incoming.length === 0) return setNotice({ kind: 'error', text: 'No valid presets found in that file.' });
    updatePresets((l) => mergePresets(l, incoming));
    setNotice({ kind: 'ok', text: `Loaded ${incoming.length} preset(s).` });
  };

  const onDrop = (id: number) => (e: DragEvent) => {
    e.preventDefault();
    const presetId = e.dataTransfer.getData(PRESET_DRAG_TYPE);
    if (presetId) {
      if (!busy) writePreset(id, presetId);
      return;
    }
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

  const writeDraft = () => {
    if (!draft) return;
    const fit = fitProfile(draft, cap);
    if (!fit.ok) return setNotice({ kind: 'error', text: fit.errors.map((e) => e.message).join(' ') });
    requestWrite(selected, fit.profile, fit.notes.length ? ` ${fit.notes.join(' ')}` : '', slotName(selected), fit.warnings.join(' '));
  };

  const copyShare = async () => {
    if (!shown) return;
    const frag = encodeShareFragment({ name: fileBase, profile: shown });
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}#${frag}`);
      setNotice({ kind: 'ok', text: 'Share link copied.' });
    } catch {
      setNotice({ kind: 'error', text: 'The browser blocked clipboard access. Allow it and try again.' });
    }
  };

  const fileBase = slotName(selected) || `${product} slot ${Number(index(selected))}`;
  const sel = index(selected);

  return (
    <div className={`workspace${dragging ? ' is-dragging' : ''}`}>
      <div className="sticky">
        <header className="hud">
          <span className="hud-dot" />
          <span className="hud-title">{product}</span>
          <span className="hud-item mono">
            Playing: {active === null ? '--' : userSlots.some((s) => s.id === active) ? `slot ${index(active)}` : eqOff ? 'EQ off' : 'built-in preset'}
          </span>
          {cap.eqOffSlotId !== null && (
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
          )}
        </header>
        {notice && (
          <div className={`notice notice-${notice.kind}`} role={notice.kind === 'error' || notice.kind === 'confirm' || notice.kind === 'warn' ? 'alert' : 'status'}>
            {notice.kind === 'busy' && <Stripes />}
            <span className="notice-text">{notice.text}</span>
            {notice.kind === 'confirm' && (
              <>
                <button className={notice.danger === false ? 'btn-primary' : 'btn-danger'} autoFocus onClick={() => { const g = notice.go; setNotice(null); g(); }}>{notice.yes ?? 'Yes, overwrite'}</button>
                <button className="btn-secondary" onClick={() => setNotice(null)}>{notice.no ?? 'Cancel'}</button>
              </>
            )}
            {(notice.kind === 'ok' || notice.kind === 'warn') && notice.undo && <button className="btn-secondary" disabled={busy} onClick={notice.undo}>Undo</button>}
            {(notice.kind === 'error' || notice.kind === 'warn') && <button className="btn-secondary" onClick={() => setNotice(null)}>Dismiss</button>}
          </div>
        )}
      </div>

      {pending && (
        <section className="shared-preview">
          <h2 className="section-title">Shared EQ &ldquo;{pending.name || 'Untitled'}&rdquo;</h2>
          <EqGraph
            profile={pending.profile}
            label={pending.name || 'Shared EQ'}
            compare={saved && !isFlat(saved) ? { profile: saved, label: slotName(selected) || `Slot ${sel}` } : undefined}
          />
          <div className="mono caption">
            {pending.profile.bands.filter((b) => b.enabled && b.gain !== 0).length} bands &middot; {pending.profile.preamp.toFixed(1)} dB
          </div>
          {pending.warn && <p className="clip-warn" role="status">{pending.warn}</p>}
          <p>
            This is a preview. It is not on the device yet. Click a slot below to choose where it goes (the slot&rsquo;s current EQ is shown as the comparison curve), then write it.
            To test, press <strong>Activate</strong> on that slot. <strong>Undo</strong> restores the previous EQ.
          </p>
          <div className="bar">
            <button className="btn-primary" disabled={busy || !allRead} onClick={() => requestWrite(selected, pending.profile, pending.extra, pending.name, pending.warn)}>Write to slot {sel}</button>
            <button className="btn-secondary" onClick={() => setPending(null)}>Not now</button>
          </div>
        </section>
      )}

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
        {userSlots.map((s, i) => {
          const p = profiles[s.id];
          return (
            <div
              key={s.id}
              style={{ '--i': i } as CSSProperties}
              className={`slot${s.id === active ? ' slot-active' : ''}${s.id === selected ? ' slot-selected' : ''}${dragOver === s.id ? ' slot-drop' : ''}${s.id === cmpId ? ' slot-compare' : ''}`}
              onClick={() => { setSelected(s.id); setCompareId((c) => (c === s.id ? null : c)); clearEdit(); }}
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
                {pending && s.id === selected && <span className="badge-compare">TARGET</span>}
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
            <button className="btn-secondary" disabled={!shown} title="Copies a link that contains this EQ. Nothing is uploaded." onClick={() => void copyShare()}>Copy share link</button>
          </div>
        </section>
        <section className="action-group">
          <h3 className="label">Backup</h3>
          <div className="bar">
            <button className="btn-secondary" disabled={!allRead} title="Saves every user slot's EQ and name to one file. Nothing is written to the device." onClick={exportAll}>Export all slots (.json)</button>
            <button className="btn-secondary" disabled={busy || !allRead} title="Loads a file made by Export all slots and writes every slot to the device after you confirm. Slots that already match are skipped." onClick={() => backupRef.current?.click()}>Import all slots (.json)</button>
            <button className="btn-secondary" title="Saves only the slot names (kept in this browser) to a file. It does not save any EQ settings." onClick={() => download('ozybridge-slot-names.json', serializeSlotNames(names), 'application/json')}>Save slot names to file</button>
            <button className="btn-secondary" title="Loads slot names from a file saved earlier. Names only, no EQ settings are written to the device." onClick={() => restoreRef.current?.click()}>Load slot names from file</button>
          </div>
        </section>
        <input ref={fileRef} type="file" accept=".txt,.xml" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(selected, f); }} />
        <input ref={backupRef} type="file" accept=".json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (!startRestore(await f.text())) setNotice({ kind: 'error', text: 'This is not an OzyBridge slot backup. Use a file made by Export all slots. To import one EQ, pick a slot and use Choose file.' }); }} />
        <input ref={restoreRef} type="file" accept=".json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { const parsed = parseSlotNames(await f.text()); updateNames(() => parsed); } }} />
      </div>

      <PresetLibrary
        presets={presets}
        slotLabel={sel}
        canSave={!!saved && !isFlat(saved)}
        busy={busy}
        onSave={savePreset}
        onRename={(id, n) => updatePresets((l) => renamePreset(l, id, n))}
        onDelete={(id) => updatePresets((l) => deletePreset(l, id))}
        onWrite={(id) => writePreset(selected, id)}
        onBackup={() => download(`ozybridge-presets-${new Date().toISOString().slice(0, 10)}.json`, serializePresets(presets), 'application/json')}
        onLoad={loadPresets}
      />

      {shown && (
        <EqEditor
          heading={<>Slot {sel} {slotName(selected)}</>}
          profile={shown}
          limits={cap}
          resetKey={resetKey}
          label={slotName(selected) || `Slot ${sel}`}
          compare={compare}
          sweep={sweep}
          onChange={applyEdit}
          onEditStart={beginDragEdit}
          onEditEnd={endDragEdit}
          onUndo={undoEdit}
          onRedo={redoEdit}
          onNotice={(text) => setNotice({ kind: 'error', text })}
          onBlockedChange={setAnyBlocked}
          exportBar={shown && (
            <div className="bar">
              <button className="btn-secondary" onClick={() => download(`${fileBase}.txt`, exportAutoEq(shown, { omitFlat: true }), 'text/plain')}>Download .txt (Squiglink / AutoEQ)</button>
              <button className="btn-secondary" onClick={() => download(`${fileBase}.xml`, exportFiioXml(shown, { model: product, name: slotName(selected) || undefined }), 'application/xml')}>Download .xml (FiiO)</button>
              <button className="btn-secondary" title="Copies a link that contains this EQ. Nothing is uploaded." onClick={() => void copyShare()}>Copy share link</button>
            </div>
          )}
        >
          <div className="bar">
            <button className="btn-primary" disabled={!draft || busy || anyBlocked} title="Send these edits to the device and verify them" onClick={writeDraft}>Save changes to slot {sel}</button>
            {anyBlocked && <span className="field-error">Fix the highlighted number fields before saving.</span>}
            <button className="btn-secondary" disabled={!canUndo} onClick={undoEdit}>Undo</button>
            <button className="btn-secondary" disabled={!canRedo} onClick={redoEdit}>Redo</button>
            <button className="btn-secondary" disabled={!draft} title="Throw away unsaved edits and show what is currently on the device" onClick={() => { clearEdit(); setUndoCount((n) => n + 1); }}>Discard changes</button>
          </div>
        </EqEditor>
      )}

      {dragging && <div className="drop-overlay" aria-hidden><span>Drop on a slot to load it</span></div>}
    </div>
  );
}
