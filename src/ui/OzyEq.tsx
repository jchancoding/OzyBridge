import { useEffect, useMemo, useRef, useState } from 'react';
import { exportAutoEq, parseAutoEq } from '../core/autoeq';
import { exportGraphicEq } from '../core/graphicEq';
import type { EqLimits, EqProfile } from '../core/eq';
import { parseFiioXml } from '../core/fiioXml';
import { fitProfile } from '../core/fit';
import { emptyProfile, FREE_LIMITS } from '../core/freeLimits';
import { decodeShareFragment, encodeShareFragment } from '../core/shareLink';
import { FIIO_MODELS } from '../devices/fiio/models';
import { WALKPLAY_MODELS } from '../devices/walkplay/models';
import { download } from './download';
import { EqEditor } from './EqEditor';
import { Footer } from './Footer';
import { Mascot } from './Mascot';
import './mascot.css';
import { useEqDraft } from './useEqDraft';
import { Stripes } from './Workspace';

const DRAFT_KEY = 'ozy-eq-draft';
const NO_DEVICE = '';
const DEFAULT_NAME = 'OzyEQ';

type Notice = { kind: 'ok' | 'info' | 'error' | 'warn'; text: string } | null;
type AltExportFormat = 'wavelet' | 'equalizerapo';

const DEVICES: { name: string; limits: EqLimits }[] = [...FIIO_MODELS, ...WALKPLAY_MODELS]
  .map((m) => ({ name: m.name, limits: m.capabilities as EqLimits }))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

function limitsFor(device: string): EqLimits | null {
  if (device === NO_DEVICE) return FREE_LIMITS;
  return DEVICES.find((d) => d.name === device)?.limits ?? null;
}

type Draft = { device: string; name: string; profile: EqProfile };

function restoreDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<{ v: number; device: string; name: string; profile: EqProfile }>;
    if (d.v !== 1 || typeof d.device !== 'string' || typeof d.name !== 'string' || !d.profile) return null;
    const limits = limitsFor(d.device);
    if (!limits) return null;
    const fit = fitProfile(d.profile, limits);
    if (!fit.ok) return null;
    return { device: d.device, name: d.name, profile: fit.profile };
  } catch {
    return null;
  }
}

function parseAny(text: string, fileName: string, limits: EqLimits) {
  const isXml = /\.xml$/i.test(fileName) || text.trimStart().startsWith('<');
  const parsed = isXml ? parseFiioXml(text) : parseAutoEq(text);
  if (!parsed.ok) return { ok: false as const, errors: parsed.errors.map((e) => e.message) };
  const fit = fitProfile(parsed.profile, limits);
  if (!fit.ok) return { ok: false as const, errors: fit.errors.map((e) => e.message) };
  return { ok: true as const, profile: fit.profile, name: parsed.name, notes: fit.notes, warnings: fit.warnings };
}

export function OzyEq() {
  const [initial] = useState(restoreDraft);
  const [device, setDevice] = useState(initial?.device ?? NO_DEVICE);
  const [name, setName] = useState(initial?.name ?? DEFAULT_NAME);
  const limits = useMemo(() => limitsFor(device) ?? FREE_LIMITS, [device]);
  const [base, setBase] = useState<EqProfile>(() => initial?.profile ?? emptyProfile(limits));
  const [notice, setNotice] = useState<Notice>(null);
  const [resetN, setResetN] = useState(0);
  const [altExport, setAltExport] = useState<AltExportFormat>('wavelet');
  const fileRef = useRef<HTMLInputElement>(null);

  const { shown, canUndo, canRedo, clear, apply, beginDrag, endDrag, undo, redo } = useEqDraft(base);
  const current = shown ?? base;
  const fileBase = name.trim() || DEFAULT_NAME;

  const loadFitted = (profile: EqProfile, loadedName: string, notes: string[], warnings: string[]) => {
    setBase(profile);
    clear();
    setResetN((n) => n + 1);
    const extra = notes.length ? ` ${notes.join(' ')}` : '';
    if (warnings.length) setNotice({ kind: 'warn', text: `Loaded “${loadedName}”.${extra} ${warnings.join(' ')}` });
    else setNotice({ kind: 'ok', text: `Loaded “${loadedName}”.${extra}` });
  };

  const importText = (text: string, fileName: string) => {
    const r = parseAny(text, fileName, limits);
    if (!r.ok) return setNotice({ kind: 'error', text: r.errors.join(' ') });
    const n = r.name || (fileName === 'paste.txt' ? fileBase : fileName.replace(/\.[^.]*$/, '')) || DEFAULT_NAME;
    setName(n);
    loadFitted(r.profile, n, r.notes, r.warnings);
  };

  const latest = useRef(importText);
  latest.current = importText;

  const onDevice = (next: string) => {
    const target = limitsFor(next);
    if (!target) return;
    const fit = fitProfile(current, target);
    if (!fit.ok) {
      return setNotice({ kind: 'error', text: `This EQ doesn't fit the ${next}: ${fit.errors.map((e) => e.message).join(' ')}` });
    }
    setDevice(next);
    setBase(fit.profile);
    clear();
    setResetN((n) => n + 1);
    const label = next === NO_DEVICE ? 'No device (10 bands)' : next;
    const extra = fit.notes.length ? ` ${fit.notes.join(' ')}` : '';
    setNotice({ kind: 'ok', text: `Now using ${label} limits.${extra}` });
  };

  const flatten = () => {
    apply(emptyProfile(limits));
    setResetN((n) => n + 1);
  };

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: 1, device, name, profile: current }));
  }, [device, name, current]);

  useEffect(() => {
    if (!location.hash.startsWith('#eq=')) return;
    const d = decodeShareFragment(location.hash);
    history.replaceState(null, '', location.pathname + location.search);
    if (!d.ok) return setNotice({ kind: 'error', text: d.errors.join(' ') });
    const fit = fitProfile(d.profile, limits);
    if (!fit.ok) return setNotice({ kind: 'error', text: fit.errors.map((e) => e.message).join(' ') });
    const n = d.name || DEFAULT_NAME;
    setName(n);
    loadFitted(fit.profile, n, fit.notes, fit.warnings);
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (notice?.kind !== 'ok' && notice?.kind !== 'info') return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
    const over = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const f = e.dataTransfer?.files[0];
      if (f) void f.text().then((t) => latest.current(t, f.name));
    };
    const paste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
      const text = e.clipboardData?.getData('text');
      if (text) latest.current(text, 'paste.txt');
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, []);

  const pasteButton = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return setNotice({ kind: 'error', text: 'The clipboard is empty. Copy the EQ text first.' });
      importText(text, 'paste.txt');
    } catch {
      setNotice({ kind: 'error', text: 'The browser blocked clipboard access. Click the page, then press Ctrl/Cmd+V instead.' });
    }
  };

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ kind: 'ok', text: done });
    } catch {
      setNotice({ kind: 'error', text: 'The browser blocked clipboard access. Allow it and try again.' });
    }
  };

  const altExportText = (format: AltExportFormat) =>
    format === 'wavelet' ? exportGraphicEq(current) : exportAutoEq(current);
  const altExportFile = (format: AltExportFormat) =>
    format === 'wavelet' ? `${fileBase}-wavelet.txt` : `${fileBase}-equalizerapo.txt`;

  const exportButtons = (
    <div className="bar">
      <button className="btn-primary" onClick={() => download(`${fileBase}.txt`, exportAutoEq(current, { omitFlat: true }), 'text/plain')}>Download .txt (Squiglink / AutoEQ)</button>
      <button className="btn-secondary" onClick={() => void copy(exportAutoEq(current, { omitFlat: true }), 'EQ text copied.')}>Copy as text</button>
      <label className="label" htmlFor="ozyeq-alt-export">Export other format</label>
      <select id="ozyeq-alt-export" value={altExport} onChange={(e) => setAltExport(e.target.value as AltExportFormat)}>
        <option value="wavelet">Wavelet GraphicEQ (.txt)</option>
        <option value="equalizerapo">EqualizerAPO (.txt)</option>
      </select>
      <button className="btn-secondary" onClick={() => download(altExportFile(altExport), altExportText(altExport), 'text/plain')}>Download</button>
      <button className="btn-secondary" onClick={() => void copy(altExportText(altExport), 'Export copied.')}>Copy</button>
      <button className="btn-secondary" title="Copies a link that contains this EQ. Nothing is uploaded." onClick={() => void copy(`${location.origin}${location.pathname}#${encodeShareFragment({ name: fileBase, profile: current })}`, 'Share link copied.')}>Copy share link</button>
    </div>
  );

  return (
    <>
      <main className="app screen ozyeq">
        <header className="landing-bar">
          <div className="landing-bar__brand">
            <Stripes />
            <h1 className="display">OzyEQ</h1>
          </div>
          <a className="btn-secondary" href="./">OzyBridge</a>
        </header>
        {notice && (
          <div className={`notice notice-${notice.kind}`} role={notice.kind === 'error' || notice.kind === 'warn' ? 'alert' : 'status'}>
            <span className="notice-text">{notice.text}</span>
            {(notice.kind === 'error' || notice.kind === 'warn') && <button className="btn-secondary" onClick={() => setNotice(null)}>Dismiss</button>}
          </div>
        )}
        <EqEditor
          heading="EQ"
          profile={current}
          limits={limits}
          resetKey={`${device}:${resetN}`}
          label={fileBase}
          onChange={apply}
          onEditStart={beginDrag}
          onEditEnd={endDrag}
          onUndo={undo}
          onRedo={redo}
          onNotice={(text) => setNotice({ kind: 'error', text })}
          onBlockedChange={() => {}}
          exportBar={exportButtons}
          onAutoName={setName}
          targetAside={(
            <span className="device-limits tip">
              <label className="label" htmlFor="ozyeq-device">Device limits</label>
              <select id="ozyeq-device" value={device} aria-describedby="ozyeq-device-tip" onChange={(e) => onDevice(e.target.value)}>
                <option value={NO_DEVICE}>No device (10 bands)</option>
                {DEVICES.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
              <span id="ozyeq-device-tip" className="tip__bubble" role="tooltip">Limits your EQ settings to that specific device.</span>
            </span>
          )}
          bandsHead={(
            <div className="bands-head">
              <label className="label" htmlFor="ozyeq-name">EQ name</label>
              <input id="ozyeq-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
              <h3 className="label">Import EQ</h3>
              <div className="bar">
                <button className="btn-primary" onClick={() => fileRef.current?.click()}>Choose file (.txt / .xml)</button>
                <button className="btn-secondary" onClick={() => void pasteButton()}>Paste from clipboard</button>
              </div>
              <input ref={fileRef} type="file" accept=".txt,.xml" hidden onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void f.text().then((t) => importText(t, f.name));
              }} />
            </div>
          )}
        >
          <div className="bar">
            <button className="btn-secondary" disabled={!canUndo} onClick={undo}>Undo</button>
            <button className="btn-secondary" disabled={!canRedo} onClick={redo}>Redo</button>
            <button className="btn-secondary" onClick={flatten}>Reset to flat</button>
          </div>
        </EqEditor>
        <section className="eq-panel">
          <header className="eq-panel__head">
            <span className="eq-panel__title">Export</span>
          </header>
          <div className="eq-panel__rule" aria-hidden />
          {exportButtons}
        </section>
        <Footer />
      </main>
      <Mascot />
    </>
  );
}
