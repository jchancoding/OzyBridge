import { describe, expect, it } from 'vitest';
import type { EqBand } from './eq';
import { bandResponseDb, logFrequencies, profileResponseDb } from './response';

const band = (type: EqBand['type'], freq: number, gain: number, q = 1): EqBand => ({
  type, freq, gain, q, enabled: true,
});
const at = (b: EqBand, f: number) => (bandResponseDb(b, [f])[0] as number);

describe('response', () => {
  it('PK', () => {
    const b = band('PK', 4000, 6, 2);
    expect(at(b, 4000)).toBeCloseTo(6, 6);
    expect(Math.abs(at(b, 20))).toBeLessThan(0.01);
  });
  it('LSC', () => {
    const b = band('LSC', 1000, 6);
    expect(at(b, 20)).toBeCloseTo(6, 1);
    expect(at(b, 1000)).toBeCloseTo(3, 1);
    expect(Math.abs(at(b, 20000))).toBeLessThan(0.1);
  });
  it('HSC', () => {
    const b = band('HSC', 1000, 6);
    expect(at(b, 20000)).toBeCloseTo(6, 0);
    expect(at(b, 1000)).toBeCloseTo(3, 1);
    expect(Math.abs(at(b, 20))).toBeLessThan(0.1);
  });
  it('zero gain and disabled are flat', () => {
    expect(bandResponseDb(band('PK', 1000, 0), [20, 1000, 20000])).toEqual([0, 0, 0]);
    expect(bandResponseDb({ ...band('PK', 1000, 6), enabled: false }, [20, 1000])).toEqual([0, 0]);
  });
  it('is additive and applies preamp', () => {
    const a = band('PK', 500, 3);
    const b = band('HSC', 5000, -4);
    const f = [100, 500, 5000];
    const sum = profileResponseDb({ preamp: 0, bands: [a, b] }, f);
    const ra = bandResponseDb(a, f);
    const rb = bandResponseDb(b, f);
    f.forEach((_, i) => expect(sum[i]).toBeCloseTo((ra[i] as number) + (rb[i] as number), 9));
    const shifted = profileResponseDb({ preamp: -2, bands: [a, b] }, f);
    f.forEach((_, i) => expect(shifted[i]).toBeCloseTo((sum[i] as number) - 2, 9));
    expect(profileResponseDb({ preamp: -2, bands: [a] }, f, 48000, false)[1]).toBeCloseTo(3, 6);
  });
  it('logFrequencies', () => {
    const f = logFrequencies(3);
    expect(f[0]).toBe(20);
    expect(f[1]).toBeCloseTo(632.46, 2);
    expect(f[2]).toBe(20000);
  });
});
