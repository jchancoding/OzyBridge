import { describe, expect, it } from 'vitest';
import type { EqBand, EqProfile } from './eq';
import { fromWireProfile, toWireProfile, wireQ } from './qCompensation';

const b = (over: Partial<EqBand> = {}): EqBand => ({ type: 'PK', freq: 1000, gain: 0, q: 1, enabled: true, ...over });
const p = (...bands: EqBand[]): EqProfile => ({ preamp: 0, bands });

describe('qCompensation', () => {
  it('is identity without a law', () => {
    const x = p(b({ gain: 6, q: 1.234 }));
    expect(toWireProfile(x, undefined, 0.01)).toBe(x);
    expect(fromWireProfile(x, undefined, 0.01)).toBe(x);
  });
  it('leaves shelves untouched', () => {
    const x = p(b({ type: 'LSC', gain: 9, q: 0.7 }), b({ type: 'HSC', gain: -9, q: 0.7 }));
    expect(toWireProfile(x, 'rbjGain', 0.01)).toEqual(x);
  });
  it('leaves gain 0 untouched', () => {
    expect(toWireProfile(p(b({ q: 2.37 })), 'rbjGain', 0.01).bands[0]!.q).toBe(2.37);
  });
  it('+6 dB Q 1 is 1.41 on the wire', () => {
    expect(wireQ(b({ gain: 6 }), 'rbjGain', 0.01)).toBe(1.41);
  });
  it('uses |gain| for cuts', () => {
    expect(wireQ(b({ gain: -12 }), 'rbjGain', 0.01)).toBe(2);
  });
  it('round trip stays within one step', () => {
    for (const gain of [-12, -5.3, 0.7, 3, 11.9]) {
      for (const q of [0.3, 1, 2.5, 4]) {
        const back = fromWireProfile(toWireProfile(p(b({ gain, q })), 'rbjGain', 0.01), 'rbjGain', 0.01);
        expect(Math.abs(back.bands[0]!.q - q)).toBeLessThanOrEqual(0.0100001 * 10 ** (Math.abs(gain) / 40));
      }
    }
  });
});
