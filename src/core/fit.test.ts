import { describe, expect, it } from 'vitest';
import { flatBand, profilesEqual } from './eq';
import type { EqBand, EqLimits, EqProfile } from './eq';
import { clipCheck, fitProfile } from './fit';
import { logFrequencies, profileResponseDb } from './response';

const limits: EqLimits = {
  maxBands: 10,
  filterTypes: ['PK', 'LSC', 'HSC'],
  gain: { min: -24, max: 12 },
  preamp: { min: -24, max: 12 },
  q: { min: 0.25, max: 8 },
  freq: { min: 20, max: 20000 },
  step: { gain: 0.1, q: 0.01, freq: 1 },
  defaultFreqs: [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
};

const b = (type: EqBand['type'], freq: number, gain: number, q: number): EqBand => ({
  type, freq, gain, q, enabled: true,
});
const pk = (gain: number, freq = 1000, q = 1) => b('PK', freq, gain, q);

describe('fitProfile', () => {
  it('fits the A2000 profile', () => {
    const p: EqProfile = {
      preamp: -6.9,
      bands: [
        b('LSC', 22, 6.61, 0.73), b('PK', 43, 0.99, 0.463), b('PK', 163, -5.44, 0.513),
        b('PK', 370, -1.47, 0.998), b('PK', 780, 0.66, 2.056), b('PK', 1513, -3.2, 0.789),
        b('PK', 2469, 5.11, 1.023), b('PK', 7320, -3.82, 1.583), b('HSC', 11218, -0.81, 2.083),
        b('PK', 15329, -4.6, 0.887),
      ],
    };
    const r = fitProfile(p, limits);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.profile.bands).toHaveLength(10);
    expect(r.profile.bands[0]?.gain).toBe(6.6);
    expect(r.profile.bands[0]?.q).toBe(0.73);
    expect(r.profile.bands[1]?.q).toBe(0.46);
    expect(r.notes.some((n) => n.startsWith('Rounded to device precision'))).toBe(true);
    expect(r.profile.preamp).toBeLessThanOrEqual(-6.9);
    const peak = Math.max(...profileResponseDb(r.profile, logFrequencies(2000)));
    expect(peak).toBeLessThanOrEqual(1e-9);
  });

  it('rejects too many bands, allows disabled extras', () => {
    const r = fitProfile({ preamp: -20, bands: Array.from({ length: 11 }, () => pk(0)) }, limits);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.message).toBe(
        'This EQ has 11 active filters, but the device has 10 bands. Remove 1 filter and import again.',
      );
    }
    const off = Array.from({ length: 11 }, () => ({ ...pk(0), enabled: false }));
    const ok = fitProfile({ preamp: 0, bands: [...off, ...Array.from({ length: 10 }, () => pk(0))] }, limits);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.notes).toContain('Skipped 11 filter(s) marked OFF.');
  });

  it('rounds gain before range check', () => {
    const hi = fitProfile({ preamp: -24, bands: [pk(12.06)] }, limits);
    expect(hi.ok).toBe(false);
    if (!hi.ok) {
      expect(hi.errors[0]?.message).toBe('Filter 1: gain +12.1 dB is above the device maximum of +12.0 dB.');
      expect(hi.errors[0]?.band).toBe(1);
    }
    expect(fitProfile({ preamp: -24, bands: [pk(12.04)] }, limits).ok).toBe(true);
  });

  it('rejects Q, frequency, type and reports several errors', () => {
    expect(fitProfile({ preamp: 0, bands: [pk(0, 1000, 0.2)] }, limits).ok).toBe(false);
    expect(fitProfile({ preamp: 0, bands: [pk(0, 25000)] }, limits).ok).toBe(false);
    const noHsc = { ...limits, filterTypes: ['PK', 'LSC'] as EqLimits['filterTypes'] };
    expect(fitProfile({ preamp: 0, bands: [b('HSC', 1000, 0, 1)] }, noHsc).ok).toBe(false);
    const r = fitProfile({ preamp: 0, bands: [pk(0, 1000, 0.2), pk(0, 25000), pk(13)] }, limits);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(3);
  });

  it('still accepts an EQ whose safe preamp is below the device range, with a warning', () => {
    const bands = Array.from({ length: 4 }, () => pk(12));
    const r = fitProfile({ preamp: 0, bands }, limits);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings[0]).toContain('Clipping risk');
  });

  it('pads with disabled bands', () => {
    const bands = [pk(1, 100), pk(2, 200), pk(-1, 300)];
    const r = fitProfile({ preamp: -10, bands }, limits);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.profile.bands).toHaveLength(10);
    const padded = r.profile.bands.slice(3);
    expect(padded.every((x) => !x.enabled)).toBe(true);
    expect(padded.map((x) => x.freq)).toEqual([250, 500, 1000, 2000, 4000, 8000, 16000].slice(0, 7));
    const ref: EqProfile = {
      preamp: r.profile.preamp,
      bands: [...bands, ...limits.defaultFreqs!.slice(3).map((f) => flatBand(f))],
    };
    expect(profilesEqual(r.profile, ref)).toBe(true);
  });

  it('never changes the preamp, and warns when the curve can clip', () => {
    const r = fitProfile({ preamp: 0, bands: [pk(6)] }, limits);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.profile.preamp).toBe(0);
      expect(r.warnings).toHaveLength(1);
      expect(r.warnings[0]).toContain('Clipping risk');
      expect(r.warnings[0]).toContain('-6.0 dB or lower');
      expect(r.notes.some((n) => n.startsWith('Preamp lowered'))).toBe(false);
    }
    const k = fitProfile({ preamp: -10, bands: [pk(6)] }, limits);
    expect(k.ok).toBe(true);
    if (k.ok) {
      expect(k.profile.preamp).toBe(-10);
      expect(k.warnings).toEqual([]);
    }
  });

  it('keeps a user-chosen preamp that is too high (the -2 dB case) and only warns', () => {
    const r = fitProfile({ preamp: -2, bands: [pk(5.8)] }, limits);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.profile.preamp).toBe(-2);
      expect(r.warnings[0]).toContain('-5.8 dB or lower');
    }
  });

  it('rounds the preamp to the device step', () => {
    const r = fitProfile({ preamp: -6.93, bands: [pk(0)] }, limits);
    expect(r.ok && r.profile.preamp).toBe(-6.9);
  });

  it('rejects a preamp outside the device range', () => {
    expect(fitProfile({ preamp: 12.5, bands: [pk(0)] }, limits).ok).toBe(false);
    expect(fitProfile({ preamp: -25, bands: [pk(0)] }, limits).ok).toBe(false);
  });
});

describe('clipCheck', () => {
  it('suggests the highest safe preamp, floored at the device minimum', () => {
    expect(clipCheck({ preamp: 0, bands: [pk(6)] }, limits)?.suggested).toBe(-6);
    expect(clipCheck({ preamp: -6, bands: [pk(6)] }, limits)).toBeNull();
    const huge = Array.from({ length: 10 }, () => pk(12));
    expect(clipCheck({ preamp: 0, bands: huge }, limits)?.suggested).toBe(-24);
  });
});

describe('fitProfile with qLaw', () => {
  const law: EqLimits = { ...limits, qLaw: 'rbjGain' };
  const prof = (...bands: EqBand[]): EqProfile => ({ preamp: -12, bands });

  it('accepts bands whose wire Q is in range and keeps the user Q', () => {
    const r = fitProfile(prof(pk(6, 1000, 4)), law);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.profile.bands[0]!.q).toBe(4);
  });

  it('rejects when wire Q is above the device range', () => {
    const r = fitProfile(prof(pk(12, 1000, 7)), law);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.band).toBe(1);
      expect(r.errors[0]!.message).toBe(
        'Filter 1: Q 7 at +12.0 dB needs Q 13.97 on this device; the most it takes is 8. Lower the Q or the gain.',
      );
    }
  });

  it('does not correct shelves', () => {
    expect(fitProfile(prof(b('LSC', 100, 6, 7)), law).ok).toBe(true);
  });
});
