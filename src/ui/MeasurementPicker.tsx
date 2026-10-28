import { useEffect, useMemo, useState } from 'react';
import { parseMeasurement, type Measurement } from '../core/measurement';
import type { SquigDb, SquigModel } from '../core/squiglink';
import { loadDbs, loadMeasurement, loadModels } from './squiglink';

export interface OverlayMeasurement {
  label: string;
  measurement: Measurement;
}

const MAX_MATCHES = 50;

export async function measurementFromFile(file: { name: string; text(): Promise<string> }): Promise<OverlayMeasurement> {
  const measurement = parseMeasurement(await file.text());
  return { label: `${file.name} (your file)`, measurement };
}

export function MeasurementCredit({ model, variant, db, uploadName }: {
  model?: SquigModel; variant?: string; db?: SquigDb; uploadName?: string;
}) {
  return (
    <div className="fr-credit">
      {uploadName ? (
        <span>{uploadName} (your file)</span>
      ) : model && db ? (
        <span>
          {[model.brand, model.name, variant].filter(Boolean).join(' ')} measured by{' '}
          <a href={db.baseUrl} target="_blank" rel="noopener">{db.reviewer}</a>
        </span>
      ) : null}
      <p className="hint">Approximation: a different unit and rig than yours.</p>
    </div>
  );
}

export function MeasurementPicker({ onChange }: { onChange: (m: OverlayMeasurement | null) => void }) {
  const [open, setOpen] = useState(false);
  const [dbs, setDbs] = useState<SquigDb[]>([]);
  const [dbIndex, setDbIndex] = useState(0);
  const [models, setModels] = useState<SquigModel[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [credit, setCredit] = useState<{ model?: SquigModel; variant?: string; db?: SquigDb; uploadName?: string } | null>(null);

  const db = dbs[dbIndex];

  useEffect(() => {
    if (!open || dbs.length > 0) return;
    let live = true;
    loadDbs()
      .then((list) => {
        if (!live) return;
        setDbs(list);
        const first = list.findIndex((d) => d.type.toLowerCase() === 'iems');
        setDbIndex(first >= 0 ? first : 0);
      })
      .catch(() => live && setError('Could not load the reviewer list.'));
    return () => { live = false; };
  }, [open, dbs.length]);

  useEffect(() => {
    if (!open || !db) return;
    let live = true;
    setModels([]);
    loadModels(db)
      .then((m) => live && setModels(m))
      .catch(() => live && setError(`Could not load the model list from ${db.reviewer}.`));
    return () => { live = false; };
  }, [open, db]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: { model: SquigModel; variant: { label: string; file: string } }[] = [];
    for (const model of models) {
      for (const variant of model.variants) {
        const text = `${model.brand} ${model.name} ${variant.label}`.toLowerCase();
        if (q && !text.includes(q)) continue;
        out.push({ model, variant });
        if (out.length >= MAX_MATCHES) return out;
      }
    }
    return out;
  }, [models, query]);

  async function pick(model: SquigModel, variant: { label: string; file: string }) {
    if (!db) return;
    setBusy(true);
    setError(null);
    try {
      const measurement = await loadMeasurement(db, variant.file);
      const label = `${[model.brand, model.name, variant.label].filter(Boolean).join(' ')} measured by ${db.reviewer}`;
      setCredit({ model, variant: variant.label, db });
      onChange({ label, measurement });
    } catch {
      setError(`Could not load this measurement from ${db.reviewer}.`);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const m = await measurementFromFile(file);
      setCredit({ uploadName: file.name });
      onChange(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this file.');
    }
  }

  function clear() {
    setCredit(null);
    setError(null);
    onChange(null);
  }

  if (!open) {
    return (
      <div className="fr-picker">
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>Compare with an IEM</button>
        {credit && <MeasurementCredit {...credit} />}
      </div>
    );
  }

  return (
    <div className="fr-picker">
      <div className="fr-picker__row">
        <label className="label" htmlFor="fr-reviewer">Reviewer</label>
        <select id="fr-reviewer" value={dbIndex} onChange={(e) => setDbIndex(Number(e.target.value))}>
          {dbs.map((d, i) => <option key={`${d.baseUrl}`} value={i}>{`${d.reviewer} (${d.type})`}</option>)}
        </select>
      </div>
      <div className="fr-picker__row">
        <label className="label" htmlFor="fr-search">Model</label>
        <input id="fr-search" type="search" value={query} placeholder="Search models" onChange={(e) => setQuery(e.target.value)} />
      </div>
      <ul className="fr-picker__list" aria-label="Models" aria-busy={busy}>
        {options.map(({ model, variant }) => (
          <li key={`${model.brand}|${model.name}|${variant.file}`}>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => pick(model, variant)}>
              {[model.brand, model.name, variant.label].filter(Boolean).join(' ')}
            </button>
          </li>
        ))}
      </ul>
      <div className="fr-picker__row">
        <label className="btn-secondary fr-upload">
          Upload measurement
          <input type="file" accept=".txt,.csv" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <button type="button" className="btn-secondary" onClick={clear}>Clear</button>
      </div>
      {error && <p className="hint fr-error" role="alert">{error}</p>}
      {credit && <MeasurementCredit {...credit} />}
    </div>
  );
}
