import { useEffect, useMemo, useState } from 'react';
import { parseMeasurement, type Measurement } from '../core/measurement';
import type { SquigDb, SquigModel } from '../core/squiglink';
import { loadDbs, loadMeasurement, loadModels } from './squiglink';

export interface OverlayMeasurement {
  id: string;
  label: string;
  measurement: Measurement;
}

const MAX_OVERLAYS = 3;
const MAX_MATCHES = 40;

type SquigCredit = { model: SquigModel; variant: string; db: SquigDb };

type ModelGroup = {
  brand: string;
  name: string;
  sources: { db: SquigDb; variants: SquigModel['variants'] }[];
};

function groupKey(brand: string, name: string): string {
  return `${brand}\0${name}`.toLowerCase();
}

export function modelMatches(group: { brand: string; name: string }, tokens: string[]): boolean {
  const hay = `${group.brand} ${group.name}`.toLowerCase();
  return tokens.every((token) => {
    let at = hay.indexOf(token);
    while (at >= 0) {
      const before = at === 0 ? '' : hay[at - 1] ?? '';
      if (!/[a-z0-9]/i.test(before)) return true;
      at = hay.indexOf(token, at + 1);
    }
    return false;
  });
}

async function loadCatalog(dbs: SquigDb[], onProgress: (done: number) => void): Promise<{ db: SquigDb; models: SquigModel[] }[]> {
  const out: { db: SquigDb; models: SquigModel[] }[] = [];
  let done = 0;
  let next = 0;
  async function worker() {
    while (next < dbs.length) {
      const i = next++;
      const db = dbs[i]!;
      try {
        const models = await loadModels(db);
        out.push({ db, models });
      } catch {
        /* skip reviewer */
      }
      done++;
      onProgress(done);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, dbs.length) }, () => worker()));
  return out;
}

function buildGroups(catalog: { db: SquigDb; models: SquigModel[] }[]): ModelGroup[] {
  const map = new Map<string, ModelGroup>();
  for (const { db, models } of catalog) {
    for (const model of models) {
      const key = groupKey(model.brand, model.name);
      let g = map.get(key);
      if (!g) {
        g = { brand: model.brand, name: model.name, sources: [] };
        map.set(key, g);
      }
      g.sources.push({ db, variants: model.variants });
    }
  }
  return [...map.values()].sort((a, b) =>
    `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`, undefined, { sensitivity: 'base' }),
  );
}

export async function measurementFromFile(file: { name: string; text(): Promise<string> }): Promise<OverlayMeasurement> {
  const measurement = parseMeasurement(await file.text());
  return { id: `upload:${file.name}`, label: `${file.name} (your file)`, measurement };
}

export function MeasurementCredit({
  model,
  variant,
  db,
  uploadName,
  showHint = true,
}: {
  model?: SquigModel;
  variant?: string;
  db?: SquigDb;
  uploadName?: string;
  showHint?: boolean;
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
      {showHint && <p className="hint">Approximation: a different unit and rig than yours.</p>}
    </div>
  );
}

export function MeasurementPicker({
  items,
  iemColors,
  onChange,
  onNotice,
}: {
  items: OverlayMeasurement[];
  iemColors?: readonly string[];
  onChange: (next: OverlayMeasurement[]) => void;
  onNotice: (text: string) => void;
}) {
  const [catalog, setCatalog] = useState<{ db: SquigDb; models: SquigModel[] }[]>([]);
  const [loadTotal, setLoadTotal] = useState(0);
  const [loadDone, setLoadDone] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<Record<string, SquigCredit | { uploadName: string }>>({});

  useEffect(() => {
    let live = true;
    loadDbs()
      .then((list) => {
        if (!live) return;
        const iem = list.filter((d) => d.type.toLowerCase().includes('iem'));
        setLoadTotal(iem.length);
        setLoadDone(0);
        return loadCatalog(iem, (done) => live && setLoadDone(done));
      })
      .then((cat) => live && cat && setCatalog(cat))
      .catch(() => live && setError('Could not load the reviewer list.'));
    return () => { live = false; };
  }, []);

  const groups = useMemo(() => buildGroups(catalog), [catalog]);
  const tokens = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);

  const matches = useMemo(() => {
    if (tokens.length === 0) return [];
    const out: ModelGroup[] = [];
    for (const g of groups) {
      if (!modelMatches(g, tokens)) continue;
      out.push(g);
      if (out.length >= MAX_MATCHES) break;
    }
    return out;
  }, [groups, tokens]);

  const selectedGroup = useMemo(
    () => (selectedKey ? groups.find((g) => groupKey(g.brand, g.name) === selectedKey) ?? null : null),
    [groups, selectedKey],
  );

  const reviewerOptions = useMemo(() => {
    if (!selectedGroup) return [];
    const sorted = [...selectedGroup.sources].sort((a, b) =>
      a.db.reviewer.localeCompare(b.db.reviewer, undefined, { sensitivity: 'base' }),
    );
    return sorted;
  }, [selectedGroup]);

  const measureRows = useMemo(() => {
    if (!selectedGroup) return [] as { key: string; label: string; db: SquigDb; file: string; model: SquigModel; variant: string }[];
    const sources = reviewer === 'all' ? reviewerOptions : reviewerOptions.filter((s) => s.db.baseUrl === reviewer);
    const rows: { key: string; label: string; db: SquigDb; file: string; model: SquigModel; variant: string }[] = [];
    for (const src of sources) {
      const model: SquigModel = { brand: selectedGroup.brand, name: selectedGroup.name, variants: src.variants };
      for (const v of src.variants) {
        const variantLabel = v.label || 'default';
        const label = reviewer === 'all' ? `${src.db.reviewer} — ${variantLabel}` : variantLabel;
        rows.push({
          key: `${src.db.baseUrl}|${v.file}`,
          label,
          db: src.db,
          file: v.file,
          model,
          variant: v.label,
        });
      }
    }
    return rows;
  }, [selectedGroup, reviewer, reviewerOptions]);

  function isDuplicate(next: OverlayMeasurement): boolean {
    return items.some((x) => x.id === next.id);
  }

  function addOverlay(entry: OverlayMeasurement, credit?: SquigCredit | { uploadName: string }): boolean {
    if (items.length >= MAX_OVERLAYS) {
      onNotice('You can overlay 3 IEMs. Remove one first.');
      return false;
    }
    if (isDuplicate(entry)) {
      onNotice('That measurement is already on the graph.');
      return false;
    }
    if (credit) setCredits((c) => ({ ...c, [entry.id]: credit }));
    onChange([...items, entry]);
    return true;
  }

  function removeAt(index: number) {
    const removed = items[index];
    onChange(items.filter((_, i) => i !== index));
    if (removed) {
      setCredits((c) => {
        const next = { ...c };
        delete next[removed.id];
        return next;
      });
    }
  }

  async function pickRow(row: (typeof measureRows)[number]) {
    setBusy(true);
    setError(null);
    try {
      const measurement = await loadMeasurement(row.db, row.file);
      const squigLabel = `${[row.model.brand, row.model.name, row.variant].filter(Boolean).join(' ')} measured by ${row.db.reviewer}`;
      const entry: OverlayMeasurement = {
        id: `${row.db.baseUrl}|${row.file}`,
        label: squigLabel,
        measurement,
      };
      if (addOverlay(entry, { model: row.model, variant: row.variant, db: row.db })) {
        setQuery('');
        setSelectedKey(null);
        setReviewer('all');
      }
    } catch {
      setError(`Could not load this measurement from ${row.db.reviewer}.`);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const m = await measurementFromFile(file);
      addOverlay(m, { uploadName: file.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this file.');
    }
  }

  const loading = loadTotal > 0 && loadDone < loadTotal;
  const swatches = iemColors ?? ['var(--oz-fr-1)', 'var(--oz-fr-2)', 'var(--oz-fr-3)'];

  return (
    <div className="fr-picker">
      <input
        id="fr-search"
        className="fr-search"
        type="search"
        value={query}
        placeholder="Search an IEM, for example Moondrop Aria"
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading && (
        <p className="hint" role="status">
          Loading reviewer catalogs ({loadDone} of {loadTotal})…
        </p>
      )}
      {tokens.length === 0 && !loading && <p className="hint">Type a model name</p>}
      {tokens.length > 0 && (
        <ul className="fr-picker__list" aria-label="Models">
          {matches.map((g) => {
            const key = groupKey(g.brand, g.name);
            const sel = selectedKey === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={`btn-secondary${sel ? ' fr-model-selected' : ''}`}
                  onClick={() => {
                    setSelectedKey(key);
                    setReviewer('all');
                  }}
                >
                  {[g.brand, g.name].filter(Boolean).join(' ')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selectedGroup && (
        <div className="fr-picker__row">
          <label className="label" htmlFor="fr-reviewer-pick">Reviewer</label>
          <select
            id="fr-reviewer-pick"
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
          >
            <option value="all">All reviewers</option>
            {reviewerOptions.map((s) => (
              <option key={s.db.baseUrl} value={s.db.baseUrl}>{s.db.reviewer}</option>
            ))}
          </select>
        </div>
      )}
      {selectedGroup && measureRows.length > 0 && (
        <>
          <p className="fr-next" role="status">Choose a reviewer measurement to show this model.</p>
          <ul key={selectedKey ?? ''} className="fr-picker__list fr-picker__list--cue" aria-label="Measurements" aria-busy={busy}>
            {measureRows.map((row) => (
              <li key={row.key}>
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => void pickRow(row)}>
                  {row.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {items.length > 0 && (
        <>
          <p className="hint">Dragging the EQ curve changes only the first IEM on the graph.</p>
          <ul className="fr-overlay-list" aria-label="Overlays on graph">
            {items.map((item, i) => {
              const credit = credits[item.id];
              return (
                <li key={item.id} className="fr-overlay-item">
                  <span className="fr-swatch" style={{ background: swatches[i] ?? swatches[0] }} aria-hidden />
                  <div className="fr-overlay-copy">
                    {credit && 'uploadName' in credit ? (
                      <MeasurementCredit uploadName={credit.uploadName} showHint={false} />
                    ) : credit ? (
                      <MeasurementCredit model={credit.model} variant={credit.variant} db={credit.db} showHint={false} />
                    ) : (
                      <span className="fr-overlay-label">{item.label}</span>
                    )}
                    {i === 0 && <p className="hint">EQ applies here</p>}
                  </div>
                  <button type="button" className="fr-trash" aria-label={`Remove ${item.label}`} onClick={() => removeAt(i)}>
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className="fr-picker__row">
        <label className="btn-primary fr-upload">
          Upload measurement
          <input type="file" accept=".txt,.csv" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      {(items.length > 0) && (
        <p className="hint">Approximation: a different unit and rig than yours.</p>
      )}
      {error && <p className="hint fr-error" role="alert">{error}</p>}
    </div>
  );
}
