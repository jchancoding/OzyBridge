import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TARGETS, targetUrl } from '../core/targets';
import { TargetToggles, loadTarget } from './TargetToggles';

afterEach(() => vi.unstubAllGlobals());

const txt = Array.from({ length: 40 }, (_, i) => `${(20 * Math.pow(1000, i / 39)).toFixed(2)}\t${70 + (i % 3)}`).join('\n');

describe('target toggles', () => {
  it('renders a toggle per target and fetches nothing', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const html = renderToStaticMarkup(<TargetToggles onChange={() => {}} />);
    expect(html).toContain('TARGETS');
    expect(html).toContain('target-toggle');
    expect(html.match(/aria-pressed="false"/g)?.length).toBe(TARGETS.length);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches once and caches', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => txt }));
    vi.stubGlobal('fetch', fetchMock);
    const t = TARGETS[0]!;
    const a = await loadTarget(t);
    const b = await loadTarget(t);
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(targetUrl(import.meta.env.BASE_URL, t), { credentials: 'omit' });
  });

  it('rejects on failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => '' })));
    await expect(loadTarget(TARGETS[1]!)).rejects.toThrow();
  });
});
