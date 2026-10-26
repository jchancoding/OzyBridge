import type { EqBand, EqProfile } from './eq';

export interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

export function biquad(band: EqBand, fs: number): Biquad {
  const A = Math.pow(10, band.gain / 40);
  const w0 = (2 * Math.PI * band.freq) / fs;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * band.q);
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (band.type === 'PK') {
    b0 = 1 + alpha * A;
    b1 = -2 * cos;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cos;
    a2 = 1 - alpha / A;
  } else {
    const s = 2 * Math.sqrt(A) * alpha;
    if (band.type === 'LSC') {
      b0 = A * (A + 1 - (A - 1) * cos + s);
      b1 = 2 * A * (A - 1 - (A + 1) * cos);
      b2 = A * (A + 1 - (A - 1) * cos - s);
      a0 = A + 1 + (A - 1) * cos + s;
      a1 = -2 * (A - 1 + (A + 1) * cos);
      a2 = A + 1 + (A - 1) * cos - s;
    } else {
      b0 = A * (A + 1 + (A - 1) * cos + s);
      b1 = -2 * A * (A - 1 + (A + 1) * cos);
      b2 = A * (A + 1 + (A - 1) * cos - s);
      a0 = A + 1 - (A - 1) * cos + s;
      a1 = 2 * (A - 1 - (A + 1) * cos);
      a2 = A + 1 - (A - 1) * cos - s;
    }
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

export function logFrequencies(n: number, min = 20, max = 20000): number[] {
  if (n <= 1) return [min];
  const lo = Math.log(min);
  const hi = Math.log(max);
  return Array.from({ length: n }, (_, i) =>
    i === 0 ? min : i === n - 1 ? max : Math.exp(lo + ((hi - lo) * i) / (n - 1)),
  );
}

export function bandResponseDb(band: EqBand, freqs: number[], fs = 48000): number[] {
  if (!band.enabled || band.gain === 0) return freqs.map(() => 0);
  const c = biquad(band, fs);
  return freqs.map((f) => {
    const w = (2 * Math.PI * f) / fs;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const c2 = Math.cos(2 * w);
    const s2 = Math.sin(2 * w);
    const nr = c.b0 + c.b1 * cw + c.b2 * c2;
    const ni = -(c.b1 * sw + c.b2 * s2);
    const dr = 1 + c.a1 * cw + c.a2 * c2;
    const di = -(c.a1 * sw + c.a2 * s2);
    return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
  });
}

export function profileResponseDb(
  profile: EqProfile,
  freqs: number[],
  fs = 48000,
  includePreamp = true,
): number[] {
  const out = freqs.map(() => (includePreamp ? profile.preamp : 0));
  for (const band of profile.bands) {
    const r = bandResponseDb(band, freqs, fs);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) + (r[i] as number);
  }
  return out;
}
