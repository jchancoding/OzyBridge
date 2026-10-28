import type { Range } from './eq';

export type GraphView = { center: number; halfSpan: number };

export const VIEW_HALF_SPAN_MIN = 6;
export const VIEW_HALF_SPAN_MAX = 60;
export const VIEW_CENTER_MIN = -60;
export const VIEW_CENTER_MAX = 60;

export const HALF_SPAN_NOTCHES = [6, 9, 12, 15, 18, 24, 30, 36, 48, 60] as const;

const TICK_STEPS = [0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24];

export function defaultHalfSpanFromGain(gain: Range): number {
  const raw = Math.max(Math.abs(gain.min), Math.abs(gain.max));
  const rounded = Math.ceil(raw / 6) * 6;
  const want = Math.max(12, rounded);
  return snapHalfSpanToNotch(want);
}

export function snapHalfSpanToNotch(halfSpan: number): number {
  const clamped = Math.min(VIEW_HALF_SPAN_MAX, Math.max(VIEW_HALF_SPAN_MIN, halfSpan));
  let best: (typeof HALF_SPAN_NOTCHES)[number] = HALF_SPAN_NOTCHES[0];
  let bd = Infinity;
  for (const n of HALF_SPAN_NOTCHES) {
    const d = Math.abs(n - clamped);
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}

export function defaultView(gain?: Range): GraphView {
  return { center: 0, halfSpan: gain ? defaultHalfSpanFromGain(gain) : 24 };
}

export function clampView(view: GraphView): GraphView {
  const halfSpan = snapHalfSpanToNotch(view.halfSpan);
  const center = Math.min(VIEW_CENTER_MAX, Math.max(VIEW_CENTER_MIN, view.center));
  return { center, halfSpan };
}

function notchIndex(halfSpan: number): number {
  const exact = HALF_SPAN_NOTCHES.indexOf(halfSpan as (typeof HALF_SPAN_NOTCHES)[number]);
  if (exact >= 0) return exact;
  let idx = 0;
  for (let i = 0; i < HALF_SPAN_NOTCHES.length; i++) {
    if (HALF_SPAN_NOTCHES[i] as number <= halfSpan) idx = i;
  }
  return idx;
}

/** zoomOut true = larger half-span (see more dB range). Preserves anchorDb on screen. */
export function zoomViewNotch(view: GraphView, zoomOut: boolean, anchorDb: number): GraphView {
  const idx = notchIndex(view.halfSpan);
  const next = zoomOut ? Math.min(idx + 1, HALF_SPAN_NOTCHES.length - 1) : Math.max(idx - 1, 0);
  const halfSpan = HALF_SPAN_NOTCHES[next] as number;
  if (halfSpan === view.halfSpan) return clampView(view);
  const t = view.halfSpan > 0 ? (anchorDb - view.center) / view.halfSpan : 0;
  const center = anchorDb - t * halfSpan;
  return clampView({ center, halfSpan });
}

export function panView(view: GraphView, deltaDb: number): GraphView {
  const center = Math.round((view.center + deltaDb) * 2) / 2;
  return clampView({ center, halfSpan: view.halfSpan });
}

export function tickStepForHalfSpan(halfSpan: number): number {
  let step = halfSpan;
  let best = Infinity;
  for (const s of [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24]) {
    if (halfSpan % s !== 0) continue;
    const perSide = halfSpan / s;
    if (perSide < 3 || perSide > 6) continue;
    const dist = Math.abs(perSide - 4);
    if (dist < best || (dist === best && s > step)) {
      best = dist;
      step = s;
    }
  }
  return step;
}

export function ticksFor(view: GraphView): number[] {
  const min = viewDbMin(view);
  const max = viewDbMax(view);
  const span = max - min;
  let step = TICK_STEPS[0] as number;
  let bestScore = Infinity;
  for (const s of TICK_STEPS) {
    const count = Math.floor(span / s + 1e-9) + 1;
    if (count < 6 || count > 10) continue;
    const score = Math.abs(count - 8);
    if (score < bestScore) {
      bestScore = score;
      step = s;
    }
  }
  if (bestScore === Infinity) {
    step = span / 8;
    for (const s of TICK_STEPS) {
      if (s >= step) {
        step = s;
        break;
      }
    }
  }
  const start = Math.ceil(min / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + 1e-9; t += step) {
    ticks.push(Math.round(t * 1000) / 1000);
  }
  return ticks;
}

export function viewDbMin(view: GraphView): number {
  return view.center - view.halfSpan;
}

export function viewDbMax(view: GraphView): number {
  return view.center + view.halfSpan;
}
