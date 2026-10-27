import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EqProfile } from '../core/eq';
import { EqGraph, graphDbRange, graphDbTicks, mainPlotY, thumbPlotY } from './EqGraph';

const flat = (preamp: number): EqProfile => ({ preamp, bands: [] });
const peak = (gain: number): EqProfile => ({
  preamp: 0,
  bands: [{ type: 'PK', freq: 1000, gain, q: 1, enabled: true }],
});

describe('graph scale', () => {
  it('keeps the ±15 dB axis while the curve fits', () => {
    expect(graphDbRange([0, 15, -15, 3.5])).toBe(15);
    expect(graphDbRange([])).toBe(15);
    expect(graphDbRange([Number.NaN, 10])).toBe(15);
    expect(graphDbTicks(15)).toEqual([-15, -10, -5, 0, 5, 10, 15]);
  });

  it('widens in steps so a peak past ±15 stays inside the frame', () => {
    expect(graphDbRange([15.1])).toBe(18);
    expect(graphDbRange([-24, 2])).toBe(30);
    expect(graphDbRange([40, -10])).toBe(48);
    expect(mainPlotY(-24, 30)).toBeLessThan(mainPlotY(-30, 30));
    expect(mainPlotY(-24, 30)).toBeGreaterThan(mainPlotY(0, 30));
    expect(thumbPlotY(15, 15)).toBeGreaterThan(0);
    expect(thumbPlotY(-15, 15)).toBeLessThan(48);
  });

  it('draws an out-of-range import on a wider axis', () => {
    const html = renderToStaticMarkup(<EqGraph profile={flat(-24)} />);
    expect(html).toContain('scale ±30 dB');
    expect(html).toContain('>-30<');
    expect(html).toContain('>+30<');
    expect(html).not.toContain('>-15<');
  });

  it('leaves an in-range curve on the ±15 axis', () => {
    const html = renderToStaticMarkup(<EqGraph profile={peak(6)} />);
    expect(html).toContain('scale ±15 dB');
    expect(html).toContain('>+15<');
    expect(html).toContain('>-15<');
  });

  it('uses one scale for the curve and its comparison', () => {
    const html = renderToStaticMarkup(
      <EqGraph profile={peak(3)} compare={{ profile: flat(-24), label: 'Other slot' }} />,
    );
    expect(html).toContain('scale ±30 dB');
    expect(html).toContain('compared with Other slot');
  });

  it('scales a thumbnail instead of pinning it to the edge', () => {
    const html = renderToStaticMarkup(<EqGraph profile={flat(-24)} thumb />);
    expect(html).toContain('scale ±30 dB');
    expect(html).toContain(` ${thumbPlotY(-24, 30).toFixed(1)}`);
  });
});
