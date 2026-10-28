import { describe, expect, it } from 'vitest';
import { flatBand } from './eq';
import {
  averageChannels,
  equalizedResponse,
  normalizeAt,
  parseMeasurement,
  resampleLog,
  type Measurement,
} from './measurement';

const wideSpan = Array.from({ length: 12 }, (_, i) => {
  const f = 20 * Math.pow(10, (i / 11) * Math.log10(10000 / 20));
  return `${f.toFixed(2)}\t${(i * 0.5).toFixed(2)}`;
}).join('\n');

const mFromText = (body: string): Measurement => parseMeasurement(body);

describe('parseMeasurement', () => {
  it('skips REW header lines', () => {
    const text = `* REW export
* Date: today
# comment
${wideSpan}`;
    const m = parseMeasurement(text);
    expect(m.f.length).toBeGreaterThanOrEqual(10);
    expect(m.f[0]).toBeLessThanOrEqual(100);
    expect(m.f[m.f.length - 1]).toBeGreaterThanOrEqual(10000);
  });

  it('parses CSV rows', () => {
    const text = `Frequency,SPL,Phase
${wideSpan.replace(/\t/g, ',')}`;
    const m = parseMeasurement(text);
    expect(m.f.length).toBeGreaterThanOrEqual(10);
  });

  it('throws when too few points', () => {
    expect(() => parseMeasurement('100\t0\n200\t1\n')).toThrow('No frequency response data found');
  });

  it('throws when range misses 100 Hz–10 kHz', () => {
    const narrow = Array.from({ length: 12 }, (_, i) => `${200 + i * 100}\t0`).join('\n');
    expect(() => parseMeasurement(narrow)).toThrow('Measurement does not cover 100 Hz-10 kHz');
  });

  it('dedupes duplicate frequencies keeping the last', () => {
    const text = `${wideSpan}\n1000\t99`;
    const m = parseMeasurement(text);
    const i = m.f.indexOf(1000);
    expect(m.db[i]).toBe(99);
  });
});

describe('resampleLog', () => {
  const m: Measurement = {
    f: [100, 1000, 10000],
    db: [0, 6, 12],
  };

  it('interpolates in log frequency', () => {
    const out = resampleLog(m, [316.23]);
    expect(out[0]).toBeCloseTo(3, 1);
  });

  it('holds edge values outside the measured range', () => {
    expect(resampleLog(m, [10])[0]).toBe(0);
    expect(resampleLog(m, [20000])[0]).toBe(12);
  });
});

describe('normalizeAt', () => {
  it('is 0 dB at 1 kHz', () => {
    const freqs = [100, 1000, 10000];
    const db = [3, 5, 9];
    const n = normalizeAt(db, freqs, 1000);
    expect(n[1]).toBeCloseTo(0, 9);
    expect(n[0]).toBeCloseTo(-2, 9);
  });
});

describe('averageChannels', () => {
  it('averages after resampling b onto a', () => {
    const a: Measurement = { f: [100, 1000], db: [0, 10] };
    const b: Measurement = { f: [100, 1000], db: [4, 6] };
    const avg = averageChannels(a, b);
    expect(avg.f).toEqual(a.f);
    expect(avg.db).toEqual([2, 8]);
  });
});

describe('equalizedResponse', () => {
  const m = mFromText(wideSpan);
  const freqs = [100, 1000, 5000];

  it('matches original when profile is flat', () => {
    const flat = { preamp: 0, bands: [flatBand(1000)] };
    const { original, equalized } = equalizedResponse(m, flat, freqs);
    freqs.forEach((_, i) => expect(equalized[i]).toBeCloseTo(original[i] as number, 9));
  });

  it('does not add preamp to the equalized curve', () => {
    const prof = { preamp: 6, bands: [] };
    const { original, equalized } = equalizedResponse(m, prof, freqs);
    freqs.forEach((_, i) => expect(equalized[i]).toBeCloseTo(original[i] as number, 9));
  });
});
