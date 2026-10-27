import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeasurementCredit, MeasurementPicker, measurementFromFile } from './MeasurementPicker';
import { loadMeasurement } from './squiglink';

afterEach(() => vi.unstubAllGlobals());

const rew = Array.from({ length: 40 }, (_, i) => `${(20 * Math.pow(1000, i / 39)).toFixed(2)}\t${70 + (i % 3)}`).join('\n');

describe('measurement picker', () => {
  it('fetches nothing before the button is clicked', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const html = renderToStaticMarkup(<MeasurementPicker onChange={() => {}} />);
    expect(html).toContain('Compare with an IEM');
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
