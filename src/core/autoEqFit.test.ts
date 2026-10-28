import { describe, expect, it } from 'vitest';
import { fitAutoEq } from './autoEqFit';
import type { EqBand } from './eq';
import { FREE_LIMITS } from './freeLimits';
import type { Measurement } from './measurement';
import { normalizeAt, resampleLog } from './measurement';
import { bandResponseDb, logFrequencies } from './response';

function flatMeasurement(db: number, n = 24): Measurement {
  const f = logFrequencies(n, 20, 20000);
  return { f, db: f.map(() => db) };
}

function desiredRmse(source: Measurement, target: Measurement): number {
  const freqs = logFrequencies(48);
  const sourceNorm = normalizeAt(resampleLog(source, freqs), freqs, 1000);
  const targetNorm = normalizeAt(resampleLog(target, freqs), freqs, 1000);
  const desired = targetNorm.map((v, i) => v - (sourceNorm[i] as number));
  return Math.sqrt(desired.reduce((s, v) => s + v * v, 0) / desired.length);
}

describe('fitAutoEq', () => {
  it('leaves flat identical curves nearly unchanged', () => {
    const m = flatMeasurement(65, 24);
    const { profile, errorDb } = fitAutoEq({
      source: m,
      target: m,
      bandCount: 5,
      limits: FREE_LIMITS,
    });
    expect(errorDb).toBeLessThan(0.5);
    for (const b of profile.bands) {
      if (b.enabled) expect(b.gain).toBe(0);
    }
  });

  it('fits a single peaking bump in the target', () => {
    const source = flatMeasurement(70, 30);
    const pk: EqBand = { type: 'PK', freq: 200, gain: 6, q: 1.4, enabled: true };
    const bump = bandResponseDb(pk, source.f);
    const target: Measurement = {
      f: source.f,
      db: source.db.map((v, i) => v + (bump[i] as number)),
    };
    const flatError = desiredRmse(source, target);
    const { profile, errorDb } = fitAutoEq({
      source,
      target,
      bandCount: 5,
      limits: FREE_LIMITS,
    });
    const enabled = profile.bands.filter((b) => b.enabled && b.gain !== 0);
    expect(enabled.length).toBeGreaterThanOrEqual(1);
    const hit = enabled.find(
      (b) => b.freq >= 100 && b.freq <= 400 && b.gain >= 3 && b.gain <= 9,
    );
    expect(hit).toBeDefined();
    expect(errorDb).toBeLessThan(flatError);
  });

  it('respects bandCount when maxBands is larger', () => {
    const source = flatMeasurement(70, 30);
    const target = flatMeasurement(75, 30);
    const { profile } = fitAutoEq({
      source,
      target,
      bandCount: 5,
      limits: FREE_LIMITS,
    });
    expect(profile.bands.length).toBe(FREE_LIMITS.maxBands);
    const enabledCount = profile.bands.filter((b) => b.enabled && b.gain !== 0).length;
    expect(enabledCount).toBeLessThanOrEqual(5);
  });

  it('clamps band gains to device limits', () => {
    const source = flatMeasurement(70, 30);
    const freqs = source.f;
    const target: Measurement = {
      f: freqs,
      db: freqs.map((f) => (Math.abs(f - 500) < 80 ? 90 : 70)),
    };
    const limits = { ...FREE_LIMITS, gain: { min: -12, max: 12 } };
    const { profile } = fitAutoEq({ source, target, bandCount: 5, limits });
    for (const b of profile.bands) {
      if (b.enabled && b.gain !== 0) {
        expect(b.gain).toBeGreaterThanOrEqual(limits.gain.min);
        expect(b.gain).toBeLessThanOrEqual(limits.gain.max);
      }
    }
  });

  it('never exceeds maxBands even when bandCount is higher', () => {
    const source = flatMeasurement(70, 30);
    const freqs = source.f;
    const target: Measurement = {
      f: freqs,
      db: freqs.map((f, i) => 70 + Math.sin(i * 0.7) * 8),
    };
    const limits = { ...FREE_LIMITS, maxBands: 8 };
    const { profile } = fitAutoEq({ source, target, bandCount: 10, limits });
    expect(profile.bands.length).toBe(8);
    const enabled = profile.bands.filter((b) => b.enabled && b.gain !== 0);
    expect(enabled.length).toBeLessThanOrEqual(8);
  });
});
