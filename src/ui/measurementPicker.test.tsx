import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MeasurementCredit,
  MeasurementPicker,
  buildGroups,
  measurementFromFile,
  modelMatches,
  reviewerSummary,
  variantLabel,
} from './MeasurementPicker';
import { loadMeasurement } from './squiglink';

afterEach(() => vi.unstubAllGlobals());

const rew = Array.from({ length: 40 }, (_, i) => `${(20 * Math.pow(1000, i / 39)).toFixed(2)}\t${70 + (i % 3)}`).join('\n');

describe('model search', () => {
  it('matches a model name and skips a token buried inside another word', () => {
    expect(modelMatches({ brand: 'Moondrop', name: 'Aria' }, ['aria'])).toBe(true);
    expect(modelMatches({ brand: 'FIIL', name: 'Key Pro EQ Variation' }, ['aria'])).toBe(false);
  });

  it('groups reviewer spellings into one model with the common spelling', () => {
    const db = (reviewer: string) => ({ reviewer, type: 'IEMs', baseUrl: `https://${reviewer}.example/` });
    const m = (brand: string, name: string) => ({ brand, name, variants: [{ label: '', file: name }] });
    const groups = buildGroups([
      { db: db('a'), models: [m('7Hz', 'Salnotes Zero 2')] },
      { db: db('b'), models: [m('7HZ', 'SALNOTES ZERO 2')] },
      { db: db('c'), models: [m('7Hz', 'Salnotes Zero 2'), m('7Hz', 'Salnotes Zero 2 (sample 02)')] },
      { db: db('d'), models: [m('TangZu', 'Wu'), m('TangZu', 'Wu x HBB')] },
    ]);
    expect(groups.map((g) => g.display)).toEqual(['7Hz Salnotes Zero 2', 'TangZu Wu', 'TangZu Wu x HBB']);
    expect(groups[0]?.sources.map((s) => s.detail)).toEqual(['', '', '', '(sample 02)']);
    expect(modelMatches({ brand: '', name: groups[0]!.hay }, ['salnotes', 'zero', '2'])).toBe(true);
  });

  it('summarises reviewers', () => {
    expect(reviewerSummary(['Lestat'])).toBe('Lestat');
    expect(reviewerSummary(['A', 'B', 'C'])).toBe('A, B, C');
    expect(reviewerSummary(['A', 'B', 'C', 'D', 'E'])).toBe('5 reviewers: A, B +3');
  });

  it('labels variants with the detail moved out of the model name', () => {
    expect(variantLabel('(sample 02)', '')).toBe('(sample 02)');
    expect(variantLabel('(sample 01)', 'foam')).toBe('(sample 01) foam');
    expect(variantLabel('(sample 01)', 'Zero 2 (foam) (sample 01)')).toBe('Zero 2 (foam) (sample 01)');
  });
});

describe('measurement picker', () => {
  it('fetches nothing on static render', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const html = renderToStaticMarkup(<MeasurementPicker items={[]} onChange={() => {}} onNotice={() => {}} />);
    expect(html).toContain('id="fr-search"');
    expect(html).toContain('Search an IEM, for example Moondrop Aria');
    expect(html).not.toContain('Compare with an IEM');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('credits the reviewer', () => {
    const html = renderToStaticMarkup(
      <MeasurementCredit
        model={{ brand: 'Moondrop', name: 'Aria', variants: [] }}
        variant="2"
        db={{ reviewer: 'Super Review', type: 'IEMs', baseUrl: 'https://squig.link/' }}
      />,
    );
    expect(html).toContain('Moondrop Aria 2 measured by');
    expect(html).toContain('Super Review');
    expect(html).toContain('rel="noopener"');
    expect(html).toContain('Approximation: a different unit and rig than yours.');
  });

  it('turns an uploaded REW text file into an overlay', async () => {
    const m = await measurementFromFile({ name: 'mine.txt', text: async () => `* REW\n${rew}` });
    expect(m.label).toBe('mine.txt (your file)');
    expect(m.measurement.f.length).toBe(40);
  });

  it('rejects when every fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('CORS')));
    await expect(
      loadMeasurement({ reviewer: 'X', type: 'IEMs', baseUrl: 'https://x.example/' }, 'Broken'),
    ).rejects.toThrow();
  });

  it('uses one channel when the other fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('%20L.txt') ? { ok: true, text: async () => rew } : { ok: false, status: 404, text: async () => '' }));
    const m = await loadMeasurement({ reviewer: 'X', type: 'IEMs', baseUrl: 'https://x.example/' }, 'One');
    expect(m.f.length).toBe(40);
  });
});
