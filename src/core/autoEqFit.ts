import { flatBand, type EqBand, type EqLimits, type EqProfile, type Range } from './eq';
import type { Measurement } from './measurement';
import { normalizeAt, resampleLog } from './measurement';
import { bandResponseDb, logFrequencies, profileResponseDb } from './response';

const FS = 48000;
const Q_GRID = [0.7, 1, 1.4, 2, 3, 5] as const;
const GAIN_MULTS = [1, 0.5, 0.25] as const;
const STOP_DB = 0.3;

function decimals(step: number): number {
  const s = String(step);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

function roundStep(v: number, step: number): number {
  const d = decimals(step);
  const n = Math.round(v / step);
  return Number((n * step).toFixed(d));
}

function floorStep(v: number, step: number): number {
  const d = decimals(step);
  const n = Math.floor(v / step + 1e-9);
  return Number((n * step).toFixed(d));
}

function clamp(v: number, range: Range): number {
  return Math.min(range.max, Math.max(range.min, v));
}

function sumSq(values: number[]): number {
  let s = 0;
  for (const v of values) s += v * v;
  return s;
}

function residualAfter(
  residual: number[],
  response: number[],
): number[] {
  return residual.map((v, i) => v - (response[i] as number));
}

function buildBand(freq: number, gain: number, q: number, limits: EqLimits): EqBand {
  return {
    type: 'PK',
    freq: roundStep(clamp(freq, limits.freq), limits.step.freq),
    gain: roundStep(clamp(gain, limits.gain), limits.step.gain),
    q: roundStep(clamp(q, limits.q), limits.step.q),
    enabled: true,
  };
}

function peakIndex(residual: number[]): { index: number; abs: number } {
  let index = 0;
  let abs = 0;
  for (let i = 0; i < residual.length; i++) {
    const a = Math.abs(residual[i] as number);
    if (a > abs) {
      abs = a;
      index = i;
    }
  }
  return { index, abs };
}

function fitBands(
  freqs: number[],
  desired: number[],
  maxBands: number,
  limits: EqLimits,
): { bands: EqBand[]; residual: number[] } {
  const residual = desired.slice();
  const kept: EqBand[] = [];
  for (let n = 0; n < maxBands; n++) {
    const { index, abs } = peakIndex(residual);
    if (abs < STOP_DB) break;
    const peakFreq = freqs[index] as number;
    const rawGain = residual[index] as number;
    const clampedGain = clamp(rawGain, limits.gain);
    const beforeSq = sumSq(residual);
    let best: { band: EqBand; response: number[]; afterSq: number } | null = null;
    for (const mult of GAIN_MULTS) {
      const trialGain = clampedGain * mult;
      if (trialGain === 0) continue;
      for (const qRaw of Q_GRID) {
        const band = buildBand(peakFreq, trialGain, qRaw, limits);
        if (band.gain === 0) continue;
        const response = bandResponseDb(band, freqs, FS);
        const after = residualAfter(residual, response);
        const afterSq = sumSq(after);
        if (afterSq >= beforeSq) continue;
        if (!best || afterSq < best.afterSq) {
          best = { band, response, afterSq };
        }
      }
    }
    if (!best) break;
    kept.push(best.band);
    for (let i = 0; i < residual.length; i++) {
      residual[i] = (residual[i] as number) - (best.response[i] as number);
    }
  }
  kept.sort((a, b) => a.freq - b.freq);
  return { bands: kept, residual };
}

function preampForBands(bands: EqBand[], limits: EqLimits): number {
  const peak = Math.max(
    ...profileResponseDb({ preamp: 0, bands }, logFrequencies(2000), FS, false),
  );
  if (peak <= 0) return 0;
  const p = floorStep(-peak, limits.step.gain);
  return clamp(Math.min(0, p), limits.preamp);
}

function profileFromBands(fitted: EqBand[], limits: EqLimits): EqProfile {
  const bands: EqBand[] = fitted.map((b) => ({ ...b }));
  for (let i = bands.length; i < limits.maxBands; i++) {
    bands.push({ ...flatBand(limits.defaultFreqs?.[i] ?? 1000), enabled: false, gain: 0 });
  }
  const preamp = preampForBands(fitted, limits);
  return { preamp, bands };
}

export function fitAutoEq(req: {
  source: Measurement;
  target: Measurement;
  bandCount: number;
  limits: EqLimits;
}): { profile: EqProfile; errorDb: number } {
  const freqs = logFrequencies(48);
  const sourceNorm = normalizeAt(resampleLog(req.source, freqs), freqs, 1000);
  const targetNorm = normalizeAt(resampleLog(req.target, freqs), freqs, 1000);
  const desired = targetNorm.map((v, i) => v - (sourceNorm[i] as number));
  const maxBands = Math.min(req.bandCount, req.limits.maxBands);
  const { bands, residual } = fitBands(freqs, desired, maxBands, req.limits);
  const profile = profileFromBands(bands, req.limits);
  const errorDb = Math.sqrt(sumSq(residual) / residual.length);
  return { profile, errorDb };
}
