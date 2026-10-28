import { describe, expect, it } from 'vitest';
import type { EqLimits } from './eq';
import { fitProfile } from './fit';
import { emptyProfile, FREE_LIMITS } from './freeLimits';

describe('emptyProfile', () => {
  it('uses FREE_LIMITS default frequencies for 10 flat bands', () => {
    const p = emptyProfile(FREE_LIMITS);
    expect(p.preamp).toBe(0);
    expect(p.bands).toHaveLength(10);
    expect(p.bands.map((b) => b.freq)).toEqual(FREE_LIMITS.defaultFreqs);
    p.bands.forEach((b) => {
      expect(b.gain).toBe(0);
      expect(b.enabled).toBe(true);
    });
  });

  it('log-spaces frequencies when defaultFreqs is omitted', () => {
    const limits: EqLimits = { ...FREE_LIMITS, maxBands: 8, defaultFreqs: undefined };
    const p = emptyProfile(limits);
    expect(p.bands).toHaveLength(8);
    const freqs = p.bands.map((b) => b.freq);
    for (let i = 1; i < freqs.length; i++) {
      expect(freqs[i] as number).toBeGreaterThan(freqs[i - 1] as number);
    }
    freqs.forEach((f) => {
      expect(f).toBeGreaterThanOrEqual(limits.freq.min);
      expect(f).toBeLessThanOrEqual(limits.freq.max);
    });
    expect(freqs[0]).toBe(32);
    expect(freqs[freqs.length - 1]).toBe(16000);
  });

  it('log-spaces when defaultFreqs has fewer entries than maxBands', () => {
    const p = emptyProfile({ ...FREE_LIMITS, maxBands: 31 });
    expect(p.bands).toHaveLength(31);
  });
});

describe('FREE_LIMITS', () => {
  it('fits an empty profile', () => {
    expect(fitProfile(emptyProfile(FREE_LIMITS), FREE_LIMITS).ok).toBe(true);
  });
});
