import type { EqProfile } from './eq';
import { profileResponseDb } from './response';

export interface Measurement {
  f: number[];
  db: number[];
}

function splitDataLine(line: string): string[] {
  return line.trim().split(/[\t,;\s]+/).filter(Boolean);
}

export function parseMeasurement(text: string): Measurement {
  const rows: { f: number; db: number }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('#')) continue;
    if (!/^\d/.test(trimmed)) continue;
    const parts = splitDataLine(line);
    if (parts.length < 2) continue;
    const f = Number(parts[0]);
    const db = Number(parts[1]);
    if (!Number.isFinite(f) || !Number.isFinite(db) || f <= 0) continue;
    rows.push({ f, db });
  }
  rows.sort((a, b) => a.f - b.f);
  const f: number[] = [];
  const db: number[] = [];
  for (const row of rows) {
    if (f.length > 0 && f[f.length - 1] === row.f) {
      db[db.length - 1] = row.db;
    } else {
      f.push(row.f);
      db.push(row.db);
    }
  }
  if (f.length < 10) throw new Error('No frequency response data found');
  const fMin = f[0] as number;
  const fMax = f[f.length - 1] as number;
  if (fMin > 100 || fMax < 10000) {
    throw new Error('Measurement does not cover 100 Hz-10 kHz');
  }
  return { f, db };
}

export function resampleLog(m: Measurement, freqs: number[]): number[] {
  const { f, db } = m;
  if (f.length === 0) return freqs.map(() => 0);
  const logF = f.map((x) => Math.log10(x));
  const minLog = logF[0] as number;
  const maxLog = logF[logF.length - 1] as number;
  const d0 = db[0] as number;
  const dLast = db[db.length - 1] as number;
  return freqs.map((target) => {
    const logT = Math.log10(target);
    if (logT <= minLog) return d0;
    if (logT >= maxLog) return dLast;
    let i = 0;
    while (i < f.length - 2 && (logF[i + 1] as number) < logT) i++;
    const lo = logF[i] as number;
    const hi = logF[i + 1] as number;
    const t = hi === lo ? 0 : (logT - lo) / (hi - lo);
    return (db[i] as number) + t * ((db[i + 1] as number) - (db[i] as number));
  });
}

export function normalizeAt(db: number[], freqs: number[], hz = 1000): number[] {
  const ref = resampleLog({ f: freqs, db }, [hz])[0] as number;
  return db.map((v) => v - ref);
}

export function averageChannels(a: Measurement, b: Measurement): Measurement {
  const bDb = resampleLog(b, a.f);
  return {
    f: a.f,
    db: a.db.map((v, i) => (v + (bDb[i] as number)) / 2),
  };
}

export function equalizedResponse(
  m: Measurement,
  profile: EqProfile,
  freqs: number[],
): { original: number[]; equalized: number[] } {
  const resampled = resampleLog(m, freqs);
  const original = normalizeAt(resampled, freqs);
  const delta = profileResponseDb(profile, freqs, 48000, false);
  const equalized = original.map((v, i) => v + (delta[i] as number));
  return { original, equalized };
}
