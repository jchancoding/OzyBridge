import type { EqBand, EqProfile } from './eq';

export type QLaw = 'rbjGain';

// FiiO KA17/QX13 realise Q_sent / 10^(|gain|/40) on peaking bands (devicePEQ test measurements).
const factor = (b: EqBand): number => 10 ** (Math.abs(b.gain) / 40);

function round(v: number, step: number): number {
  const d = (String(step).split('.')[1] ?? '').length;
  return Number((Math.round(v / step + 1e-9) * step).toFixed(d));
}

export function wireQ(band: EqBand, law: QLaw | undefined, qStep: number): number {
  if (!law || band.type !== 'PK') return band.q;
  return round(band.q * factor(band), qStep);
}

export function userQ(band: EqBand, law: QLaw | undefined, qStep: number): number {
  if (!law || band.type !== 'PK') return band.q;
  return round(band.q / factor(band), qStep);
}

const map = (p: EqProfile, f: (b: EqBand) => number): EqProfile => ({
  ...p,
  bands: p.bands.map((b) => ({ ...b, q: f(b) })),
});

export function toWireProfile(profile: EqProfile, law: QLaw | undefined, qStep: number): EqProfile {
  return law ? map(profile, (b) => wireQ(b, law, qStep)) : profile;
}

export function fromWireProfile(profile: EqProfile, law: QLaw | undefined, qStep: number): EqProfile {
  return law ? map(profile, (b) => userQ(b, law, qStep)) : profile;
}
