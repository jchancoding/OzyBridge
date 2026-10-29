import { describe, expect, it } from 'vitest';
import type { EqBand, EqProfile } from './eq';
import { exportGraphicEq, GRAPHIC_EQ_FREQUENCIES } from './graphicEq';
import { profileResponseDb } from './response';

const band = (freq: number, gain: number, q = 1): EqBand => ({
  type: 'PK', freq, gain, q, enabled: true,
});

const pairsFromLine = (line: string): string[] => {
  const body = line.replace(/^GraphicEQ:\s*/, '');
  return body.split(';').map((s) => s.trim()).filter(Boolean);
};

describe('graphicEq', () => {
  it('uses exactly 127 AutoEQ frequencies', () => {
    expect(GRAPHIC_EQ_FREQUENCIES).toHaveLength(127);
  });

  it('flat profile yields 127 zeros', () => {
    const profile: EqProfile = { preamp: 0, bands: [] };
    const line = exportGraphicEq(profile);
    expect(line.startsWith('GraphicEQ: ')).toBe(true);
    const pairs = pairsFromLine(line);
    expect(pairs).toHaveLength(127);
    for (const p of pairs) {
      expect(p.endsWith(' 0.0')).toBe(true);
    }
  });

  it('single PK +6 dB at 1 kHz peaks near 1000 Hz', () => {
    const profile: EqProfile = { preamp: 0, bands: [band(1000, 6, 1)] };
    const freqs = [...GRAPHIC_EQ_FREQUENCIES];
    let nearest = freqs[0] as number;
    let nearestIdx = 0;
    for (let i = 1; i < freqs.length; i++) {
      const f = freqs[i] as number;
      if (Math.abs(f - 1000) < Math.abs(nearest - 1000)) {
        nearest = f;
        nearestIdx = i;
      }
    }
    const expected = profileResponseDb(profile, freqs)[nearestIdx] as number;
    const pairs = pairsFromLine(exportGraphicEq(profile));
    const atNearest = pairs[nearestIdx]?.split(/\s+/);
    expect(atNearest?.[0]).toBe(String(nearest));
    expect(Number(atNearest?.[1])).toBeCloseTo(expected, 1);
    expect(Number(atNearest?.[1])).toBeCloseTo(6, 0);
  });

  it('preamp shifts every value', () => {
    const base: EqProfile = { preamp: 0, bands: [] };
    const shifted: EqProfile = { preamp: -2.5, bands: [] };
    const baseDb = profileResponseDb(base, [...GRAPHIC_EQ_FREQUENCIES]);
    const shiftedDb = profileResponseDb(shifted, [...GRAPHIC_EQ_FREQUENCIES]);
    const pairs = pairsFromLine(exportGraphicEq(shifted));
    expect(pairs).toHaveLength(127);
    for (let i = 0; i < 127; i++) {
      expect((shiftedDb[i] as number) - (baseDb[i] as number)).toBeCloseTo(-2.5, 6);
      expect(pairs[i]?.endsWith(' -2.5')).toBe(true);
    }
  });

  it('output has exactly 127 frequency–gain pairs', () => {
    const profile: EqProfile = {
      preamp: 1,
      bands: [band(500, 3), band(4000, -1.5, 2)],
    };
    expect(pairsFromLine(exportGraphicEq(profile))).toHaveLength(127);
  });
});
