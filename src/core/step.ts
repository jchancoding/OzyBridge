import type { Range } from './eq';

export function stepValue(value: number, step: number, dir: 1 | -1, coarse: boolean, range: Range): number {
  const s = coarse ? step * 10 : step;
  const d = (String(step).split('.')[1] ?? '').length;
  const next = Number((value + dir * s).toFixed(d));
  return Math.min(range.max, Math.max(range.min, next));
}

// Strict decimal text: "-", "-.", "" and "1e3" are not numbers yet.
export function parseDecimal(text: string): number | null {
  const t = text.trim();
  return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : null;
}

export type Committed = { ok: true; value: number } | { ok: false; message: string };

// Final value for a numeric field on blur or Enter: rounds to the device step and clamps to range.
export function commitNumber(text: string, step: number, range: Range): Committed {
  const n = parseDecimal(text);
  if (n === null) return { ok: false, message: 'Enter a number.' };
  const d = (String(step).split('.')[1] ?? '').length;
  const rounded = Number((Math.round(n / step) * step).toFixed(d));
  return { ok: true, value: Math.min(range.max, Math.max(range.min, rounded)) };
}

export function inRange(n: number | null, range: Range): n is number {
  return n !== null && n >= range.min && n <= range.max;
}
