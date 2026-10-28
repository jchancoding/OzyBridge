import { describe, expect, it } from 'vitest';
import type { EqBand, EqProfile } from './eq';
import {
  bandsAtCap,
  addBandAt,
  deleteBand,
  dragGain,
  firstUnused,
  nextAddIndex,
  freqFromRatio,
  isUnused,
  nearestBand,
  nudgeFreq,
  nearCurve,
  ratioFromFreq,
  snapBand,
  usedCount,
  wheelQ,
  type GraphEditCap,
} from './graphEdit';
import { profileResponseDb } from './response';

const cap: GraphEditCap = {
  freq: { min: 20, max: 20000 },
  gain: { min: -24, max: 12 },
  q: { min: 0.25, max: 8 },
  step: { freq: 1, gain: 0.1, q: 0.01 },
  maxBands: 10,
};

const band = (freq: number, gain: number, q = 1.41, type: EqBand['type'] = 'PK'): EqBand => ({
  type,
  freq,
  gain,
  q,
  enabled: true,
});

describe('freqFromRatio / ratioFromFreq', () => {
  it('maps endpoints and round-trips', () => {
    expect(freqFromRatio(0)).toBe(20);
    expect(freqFromRatio(1)).toBe(20000);
    expect(freqFromRatio(-1)).toBe(20);
    expect(freqFromRatio(2)).toBe(20000);
    expect(ratioFromFreq(20)).toBeCloseTo(0, 9);
    expect(ratioFromFreq(20000)).toBeCloseTo(1, 9);
    expect(ratioFromFreq(1000)).toBeCloseTo(Math.log10(50) / 3, 9);
    expect(ratioFromFreq(10)).toBeCloseTo(0, 9);
    expect(ratioFromFreq(99999)).toBeCloseTo(1, 9);
    const f = 432.1;
    expect(freqFromRatio(ratioFromFreq(f))).toBeCloseTo(f, 6);
  });
});

describe('snapBand', () => {
  it('merges patch, rounds to step, clamps range', () => {
    const b = band(1000, 2.04, 1.414);
    expect(snapBand(b, { freq: 1000.4, gain: 2.06, q: 1.419 }, cap)).toEqual({
      ...b,
      freq: 1000,
      gain: 2.1,
      q: 1.42,
    });
    expect(snapBand(b, { gain: 99 }, cap).gain).toBe(12);
    expect(snapBand(b, { gain: -99 }, cap).gain).toBe(-24);
    expect(snapBand(b, { freq: 5 }, cap).freq).toBe(20);
    expect(snapBand(b, { type: 'LSC' }, cap).type).toBe('LSC');
  });
});

describe('dragGain', () => {
  it('subtracts other bands and preamp at freq', () => {
    const profile = { preamp: -3, bands: [band(1000, 4), band(4000, -2)] };
    const without0 = profileResponseDb(
      { ...profile, bands: [{ ...profile.bands[0]!, enabled: false }, profile.bands[1]!] },
      [1000],
      48000,
      false,
    )[0] as number;
    expect(dragGain(without0 + 6, profile, 0, 1000)).toBeCloseTo(6, 5);
    const at1k = profileResponseDb(profile, [1000], 48000, false)[0] as number;
    expect(dragGain(at1k, profile, 0, 1000)).toBeCloseTo(profile.bands[0]!.gain, 1);
  });

  it('tracks cursor for LSC using response ratio', () => {
    const profile = { preamp: 0, bands: [band(1000, 6, 0.707, 'LSC')] };
    const freq = 1000;
    const cursorDb = 5;
    const g = dragGain(cursorDb, profile, 0, freq);
    const applied = {
      ...profile,
      bands: [{ ...profile.bands[0]!, freq, gain: g, enabled: true }],
    };
    const at = profileResponseDb(applied, [freq], 48000, false)[0] as number;
    expect(at).toBeCloseTo(cursorDb, 1);
    expect(Math.abs(at - cursorDb)).toBeLessThan(0.2);
  });
});

describe('wheelQ', () => {
  it('increases Q when deltaY is negative and respects coarse', () => {
    const q0 = 1;
    const up = wheelQ(q0, -100, false, cap);
    const upCoarse = wheelQ(q0, -100, true, cap);
    expect(up).toBeGreaterThan(q0);
    expect(upCoarse).toBeGreaterThan(up);
    const down = wheelQ(q0, 100, false, cap);
    expect(down).toBeLessThan(q0);
    expect(wheelQ(0.2, 100, false, cap)).toBe(cap.q.min);
    expect(wheelQ(20, -100, false, cap)).toBe(cap.q.max);
  });

  it('moves at least one Q step on tiny trackpad deltas', () => {
    expect(wheelQ(1, -3, false, cap)).toBe(1.01);
    expect(wheelQ(1, 2, false, cap)).toBe(0.99);
    expect(wheelQ(8, 0, false, cap)).toBe(8);
  });

  it('clamps wheel delta used in exponent', () => {
    const mild = wheelQ(1, -200, false, cap);
    const wild = wheelQ(1, -5000, false, cap);
    expect(wild).toBe(mild);
  });
});

describe('nudgeFreq', () => {
  it('steps at least one Hz from 20 when log nudge would not snap', () => {
    expect(nudgeFreq(20, 1, false, cap)).toBe(21);
    expect(nudgeFreq(20, -1, false, cap)).toBe(20);
  });

  it('nudges at mid band and respects max', () => {
    expect(nudgeFreq(1000, 1, false, cap)).toBeGreaterThan(1000);
    expect(nudgeFreq(20000, 1, false, cap)).toBe(20000);
    expect(nudgeFreq(19990, 1, false, cap)).toBe(20000);
  });
});

describe('nearestBand', () => {
  const points = [{ x: 100, y: 200 }, { x: 500, y: 180 }];

  it('returns index within radius or null', () => {
    expect(nearestBand(points, 102, 198, 18)).toBe(0);
    expect(nearestBand(points, 500, 180, 18)).toBe(1);
    expect(nearestBand(points, 300, 200, 18)).toBeNull();
    expect(nearestBand(points, 102, 198, 1)).toBeNull();
  });

  it('prefers closest when both in range', () => {
    expect(nearestBand([{ x: 0, y: 0 }, { x: 3, y: 4 }], 2, 2, 10)).toBe(1);
  });
});

describe('nearCurve', () => {
  it('is true within tolerance and false beyond', () => {
    expect(nearCurve(100, 110, 12)).toBe(true);
    expect(nearCurve(100, 88, 12)).toBe(true);
    expect(nearCurve(100, 87, 12)).toBe(false);
    expect(nearCurve(100, 113, 12)).toBe(false);
    expect(nearCurve(50, 50)).toBe(true);
  });
});

describe('bandsAtCap', () => {
  const profile = (bands: EqBand[]): EqProfile => ({ preamp: 0, bands });

  it('matches usedCount against maxBands', () => {
    const full = profile(Array.from({ length: 10 }, (_, i) => band(100 * (i + 1), 1)));
    expect(bandsAtCap(full, cap)).toBe(true);
    expect(bandsAtCap(profile([band(1000, 2)]), cap)).toBe(false);
  });
});

describe('band slots', () => {
  const profile = (bands: EqBand[]): EqProfile => ({ preamp: 0, bands });

  it('detects unused bands and counts used', () => {
    const p = profile([
      band(1000, 3),
      { ...band(2000, 0), enabled: false },
      band(500, 1),
    ]);
    expect(isUnused(p.bands[0]!)).toBe(false);
    expect(isUnused(p.bands[1]!)).toBe(true);
    expect(isUnused({ ...band(100, 0), enabled: true })).toBe(true);
    expect(usedCount(p)).toBe(2);
    expect(firstUnused(p)).toBe(1);
  });

  it('addBandAt fills the first unused slot', () => {
    const p = profile([band(1000, 2), { ...band(4000, 0), enabled: false }]);
    const r = addBandAt(p, 800, 1.5, cap);
    expect(r?.index).toBe(1);
    expect(r?.profile.bands[1]).toMatchObject({ freq: 800, gain: 1.5, enabled: true, type: 'PK' });
    expect(addBandAt(profile([band(1, 1), band(2, 2)]), 100, 1, cap)).toBeNull();
  });

  it('deleteBand clears gain and disables but keeps freq', () => {
    const p = profile([band(1234, 4)]);
    const next = deleteBand(p, 0);
    expect(next.bands[0]).toEqual({ ...p.bands[0]!, gain: 0, enabled: false, freq: 1234 });
  });

  it('nextAddIndex skips reserved slots and used bands', () => {
    const unused = { ...band(1000, 0), enabled: true };
    const p = profile([unused, { ...unused, freq: 2000 }, { ...unused, freq: 3000 }]);
    expect(nextAddIndex(p, [])).toBe(0);
    expect(nextAddIndex(p, [0])).toBe(1);
    expect(nextAddIndex(p, [0, 1, 2])).toBeNull();
    const mixed = profile([band(500, 2), unused, { ...unused, freq: 4000 }]);
    expect(nextAddIndex(mixed, [])).toBe(1);
  });
});
