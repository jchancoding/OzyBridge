import { describe, expect, it } from 'vitest';
import { flatBand, profilesEqual, type EqProfile } from './eq';

const p = (gain: number, over = {}): EqProfile => ({
  preamp: 0,
  bands: [{ ...flatBand(1000), gain, ...over }],
});

describe('flatBand', () => {
  it('is a flat enabled peak filter', () => {
    expect(flatBand(100)).toEqual({ type: 'PK', freq: 100, gain: 0, q: 1, enabled: true });
  });
});

describe('profilesEqual', () => {
  it('matches identical profiles', () => {
    expect(profilesEqual(p(3), p(3))).toBe(true);
  });
  it('accepts differences within default tolerance', () => {
    expect(profilesEqual(p(3), p(3.04, { freq: 1000.4, q: 1.004 }))).toBe(true);
  });
  it('rejects differences beyond tolerance', () => {
    expect(profilesEqual(p(3), p(3.1))).toBe(false);
    expect(profilesEqual(p(3), p(3, { freq: 1001 }))).toBe(false);
    expect(profilesEqual(p(3), p(3, { q: 1.01 }))).toBe(false);
    expect(profilesEqual(p(3), p(3, { type: 'LSC' }))).toBe(false);
  });
  it('compares preamp and band count', () => {
    expect(profilesEqual({ ...p(0), preamp: -1 }, p(0))).toBe(false);
    expect(profilesEqual(p(0), { preamp: 0, bands: [] })).toBe(false);
  });
  it('treats a disabled band as equal to an enabled zero-gain band', () => {
    expect(profilesEqual(p(5, { enabled: false }), p(0))).toBe(true);
    expect(profilesEqual(p(0), p(5, { enabled: false }))).toBe(true);
    expect(profilesEqual(p(5, { enabled: false }), p(5))).toBe(false);
  });
  it('honours a custom tolerance', () => {
    expect(profilesEqual(p(3), p(3.5), { gain: 1, freq: 1, q: 1 })).toBe(true);
  });
});
