import { flatBand, type EqLimits, type EqProfile } from './eq';

export const FREE_LIMITS: EqLimits = {
  maxBands: 10,
  filterTypes: ['PK', 'LSC', 'HSC'],
  gain: { min: -12, max: 12 },
  preamp: { min: -24, max: 12 },
  q: { min: 0.1, max: 10 },
  freq: { min: 20, max: 20000 },
  step: { gain: 0.1, q: 0.01, freq: 1 },
  defaultFreqs: [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
};

function logSpacedFreqs(n: number): number[] {
  const min = 32;
  const max = 16000;
  if (n <= 1) return [min];
  const lo = Math.log(min);
  const hi = Math.log(max);
  return Array.from({ length: n }, (_, i) => {
    if (i === 0) return min;
    if (i === n - 1) return max;
    return Math.round(Math.exp(lo + ((hi - lo) * i) / (n - 1)));
  });
}

export function emptyProfile(limits: EqLimits): EqProfile {
  const d = limits.defaultFreqs;
  const freqs = d && d.length >= limits.maxBands ? d : logSpacedFreqs(limits.maxBands);
  return {
    preamp: 0,
    bands: freqs.slice(0, limits.maxBands).map((freq) => flatBand(freq)),
  };
}
