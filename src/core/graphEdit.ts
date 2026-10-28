import type { EqBand, EqProfile, Range } from './eq';
import { bandResponseDb, profileResponseDb } from './response';
import { commitNumber } from './step';

export type GraphEditCap = {
  freq: Range;
  gain: Range;
  q: Range;
  step: { freq: number; gain: number; q: number };
  maxBands?: number;
};

export type GraphPoint = { x: number; y: number };

const F_MIN = 20;
const F_MAX = 20000;
const WHEEL_DY_CLAMP = 200;

export function freqFromRatio(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return F_MIN * Math.pow(10, 3 * u);
}

export function ratioFromFreq(f: number): number {
  const hz = Math.min(F_MAX, Math.max(F_MIN, f));
  return Math.log10(hz / F_MIN) / 3;
}

function snapValue(value: number, step: number, range: Range): number {
  const c = commitNumber(String(value), step, range);
  if (c.ok) return c.value;
  const d = (String(step).split('.')[1] ?? '').length;
  const rounded = Number((Math.round(value / step) * step).toFixed(d));
  return Math.min(range.max, Math.max(range.min, rounded));
}

function bumpIfUnchanged(
  before: number,
  after: number,
  step: number,
  range: Range,
  dir: 1 | -1,
): number {
  const snappedIn = snapValue(before, step, range);
  let snapped = snapValue(after, step, range);
  if (snapped === snappedIn) snapped = snapValue(snappedIn + dir * step, step, range);
  return snapped;
}

export function snapBand(band: EqBand, patch: Partial<EqBand>, cap: GraphEditCap): EqBand {
  const merged = { ...band, ...patch };
  return {
    ...merged,
    freq: snapValue(merged.freq, cap.step.freq, cap.freq),
    gain: snapValue(merged.gain, cap.step.gain, cap.gain),
    q: snapValue(merged.q, cap.step.q, cap.q),
  };
}

export function dragGain(
  cursorDb: number,
  profile: EqProfile,
  index: number,
  freq: number,
  includePreamp = false,
): number {
  const band = profile.bands[index];
  if (!band) return 0;
  const without = {
    ...profile,
    bands: profile.bands.map((b, i) => (i === index ? { ...b, enabled: false } : b)),
  };
  const other = profileResponseDb(without, [freq], 48000, includePreamp)[0] as number;
  const delta = cursorDb - other;
  const g0 = Math.abs(band.gain) >= 0.5 ? band.gain : 6;
  const ref = { ...band, enabled: true, gain: g0, freq };
  let r = (bandResponseDb(ref, [freq])[0] as number) / g0;
  if (Math.abs(r) < 0.05) r = 1;
  return delta / r;
}

export function wheelQ(q: number, deltaY: number, coarse: boolean, cap: GraphEditCap): number {
  if (deltaY === 0) return snapValue(q, cap.step.q, cap.q);
  const dy = Math.min(WHEEL_DY_CLAMP, Math.max(-WHEEL_DY_CLAMP, deltaY));
  const k = coarse ? 0.01 : 0.002;
  const next = q * Math.exp(-dy * k);
  const dir: 1 | -1 = deltaY < 0 ? 1 : -1;
  return bumpIfUnchanged(q, next, cap.step.q, cap.q, dir);
}

export function nudgeFreq(freq: number, dir: 1 | -1, coarse: boolean, cap: GraphEditCap): number {
  const factor = Math.pow(2, dir / (coarse ? 6 : 48));
  return bumpIfUnchanged(freq, freq * factor, cap.step.freq, cap.freq, dir);
}

export function nearestBand(
  points: GraphPoint[],
  px: number,
  py: number,
  radius: number,
): number | null {
  const r2 = radius * radius;
  let best: number | null = null;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p) continue;
    const dx = p.x - px;
    const dy = p.y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2 && d2 < bestD) {
      bestD = d2;
      best = i;
    }
  }
  return best;
}

export function isUnused(b: EqBand): boolean {
  return !b.enabled || b.gain === 0;
}

export function usedCount(profile: EqProfile): number {
  return profile.bands.filter((b) => !isUnused(b)).length;
}

export function maxBandCount(cap: GraphEditCap, profile: EqProfile): number {
  return cap.maxBands ?? profile.bands.length;
}

export function bandsAtCap(profile: EqProfile, cap: GraphEditCap): boolean {
  return usedCount(profile) >= maxBandCount(cap, profile);
}

export function nearCurve(py: number, curveY: number, tolerance = 12): boolean {
  return Math.abs(py - curveY) <= tolerance;
}

export function firstUnused(profile: EqProfile): number | null {
  const i = profile.bands.findIndex(isUnused);
  return i >= 0 ? i : null;
}

export function nextAddIndex(profile: EqProfile, reserved: readonly number[]): number | null {
  const skip = new Set(reserved);
  for (let i = 0; i < profile.bands.length; i++) {
    if (skip.has(i)) continue;
    const band = profile.bands[i];
    if (band && isUnused(band)) return i;
  }
  return null;
}

export function gainAtCursor(cursorDb: number, profile: EqProfile, freq: number): number {
  const other = profileResponseDb(profile, [freq], 48000, false)[0] as number;
  const ref: EqBand = { type: 'PK', freq, gain: 6, q: 1.41, enabled: true };
  let r = (bandResponseDb(ref, [freq])[0] as number) / 6;
  if (Math.abs(r) < 0.05) r = 1;
  return (cursorDb - other) / r;
}

export function addBandAt(
  profile: EqProfile,
  freq: number,
  gain: number,
  cap: GraphEditCap,
): { profile: EqProfile; index: number } | null {
  const index = firstUnused(profile);
  if (index === null) return null;
  const band = profile.bands[index];
  if (!band) return null;
  const next = snapBand(band, { type: 'PK', freq, gain, q: 1.41, enabled: true }, cap);
  const bands = profile.bands.map((b, i) => (i === index ? next : b));
  return { profile: { ...profile, bands }, index };
}

export function deleteBand(profile: EqProfile, index: number): EqProfile {
  const band = profile.bands[index];
  if (!band) return profile;
  const cleared = { ...band, gain: 0, enabled: false };
  return { ...profile, bands: profile.bands.map((b, i) => (i === index ? cleared : b)) };
}
