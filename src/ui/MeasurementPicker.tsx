import { useEffect, useMemo, useRef, useState } from 'react';
import { parseMeasurement, type Measurement } from '../core/measurement';
import { commonSpelling, modelIdentity, normalizeSearch, type SquigDb, type SquigModel } from '../core/squiglink';
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
  key: string;
  display: string;
  hay: string;
  sources: { db: SquigDb; model: SquigModel; detail: string }[];
};

export function variantLabel(detail: string, label: string): string {
  if (!detail || label.toLowerCase().includes(detail.toLowerCase())) return label;
  return [detail, label].filter(Boolean).join(' ');
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

export function buildGroups(catalog: { db: SquigDb; models: SquigModel[] }[]): ModelGroup[] {
  const map = new Map<string, { spellings: string[]; sources: ModelGroup['sources'] }>();
  for (const { db, models } of catalog) {
    for (const model of models) {
      const id = modelIdentity(model.brand, model.name);
      let g = map.get(id.key);
      if (!g) {
        g = { spellings: [], sources: [] };
        map.set(id.key, g);
      }
      g.spellings.push(id.spelling);
      g.sources.push({ db, model, detail: id.detail });
    }
  }
  return [...map.entries()]
    .map(([key, g]) => ({
      key,
      display: commonSpelling(g.spellings),
      hay: [key, ...new Set(g.spellings.map(normalizeSearch))].join(' | '),
      sources: g.sources,
    }))
    .sort((a, b) => a.display.localeCompare(b.display, undefined, { sensitivity: 'base' }));
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
  const searchRef = useRef<HTMLInputElement>(null);

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
  const tokens = useMemo(() => normalizeSearch(query).split(' ').filter(Boolean), [query]);

  const matches = useMemo(() => {
    if (tokens.length === 0) return [];
    const out: ModelGroup[] = [];
    for (const g of groups) {
      if (!modelMatches({ brand: '', name: g.hay }, tokens)) continue;
      out.push(g);
      if (out.length >= MAX_MATCHES) break;
    }
    return out;
  }, [groups, tokens]);

  const selectedGroup = useMemo(
    () => (selectedKey ? groups.find((g) => g.key === selectedKey) ?? null : null),
    [groups, selectedKey],
  );

  const sortedSources = useMemo(() => {
    if (!selectedGroup) return [];
    return [...selectedGroup.sources].sort((a, b) =>
      a.db.reviewer.localeCompare(b.db.reviewer, undefined, { sensitivity: 'base' }),
    );
  }, [selectedGroup]);

  const reviewerOptions = useMemo(
    () => [...new Map(sortedSources.map((s) => [s.db.baseUrl, s.db])).values()],
    [sortedSources],
  );

  const measureRows = useMemo(() => {
    if (!selectedGroup) return [] as { key: string; label: string; db: SquigDb; file: string; model: SquigModel; variant: string }[];
    const sources = reviewer === 'all' ? sortedSources : sortedSources.filter((s) => s.db.baseUrl === reviewer);
    const rows: { key: string; label: string; db: SquigDb; file: string; model: SquigModel; variant: string }[] = [];
    const seen = new Set<string>();
    for (const src of sources) {
      for (const v of src.model.variants) {
        const key = `${src.db.baseUrl}|${v.file}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const shown = variantLabel(src.detail, v.label) || 'default';
        rows.push({
          key,
          label: reviewer === 'all' ? `${src.db.reviewer} — ${shown}` : shown,
          db: src.db,
          file: v.file,
          model: src.model,
          variant: v.label,
        });
      }
    }
    return rows;
  }, [selectedGroup, reviewer, sortedSources]);

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
        ref={searchRef}
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
            const key = g.key;
            const sel = selectedKey === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={`btn-secondary${sel ? ' fr-model-selected' : ''}`}
                  onClick={() => {
                    searchRef.current?.blur();
                    setSelectedKey(key);
                    setReviewer('all');
                  }}
                >
                  {g.display}
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
            {reviewerOptions.map((db) => (
              <option key={db.baseUrl} value={db.baseUrl}>{db.reviewer}</option>
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
