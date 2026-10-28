import { describe, expect, it } from 'vitest';
import {
  clampView,
  defaultHalfSpanFromGain,
  defaultView,
  HALF_SPAN_NOTCHES,
  panView,
  snapHalfSpanToNotch,
  ticksFor,
  viewDbMax,
  viewDbMin,
  zoomViewNotch,
} from './graphView';

describe('defaultView', () => {
  it('uses ±24 dB when gain limits are asymmetric', () => {
    expect(defaultView({ min: -24, max: 12 })).toEqual({ center: 0, halfSpan: 24 });
    expect(defaultHalfSpanFromGain({ min: -24, max: 12 })).toBe(24);
    expect(defaultView()).toEqual({ center: 0, halfSpan: 24 });
  });

  it('rounds half-span up to a notch', () => {
    expect(defaultHalfSpanFromGain({ min: -18, max: 18 })).toBe(18);
    expect(defaultHalfSpanFromGain({ min: -10, max: 10 })).toBe(12);
  });
});

describe('clampView', () => {
  it('limits center and snaps half-span to notches', () => {
    expect(clampView({ center: 0, halfSpan: 3 })).toEqual({ center: 0, halfSpan: 6 });
    expect(clampView({ center: 0, halfSpan: 99 })).toEqual({ center: 0, halfSpan: 60 });
    expect(clampView({ center: -80, halfSpan: 24 })).toEqual({ center: -60, halfSpan: 24 });
    expect(clampView({ center: 0, halfSpan: 17 })).toEqual({ center: 0, halfSpan: 18 });
    expect(snapHalfSpanToNotch(22)).toBe(24);
  });
});

describe('zoomViewNotch', () => {
  it('steps half-span through notches and keeps the anchor fixed', () => {
    const v0 = { center: 0, halfSpan: 24 };
    const anchor = 6;
    const v1 = zoomViewNotch(v0, false, anchor);
    expect(v1.halfSpan).toBe(18);
    const t0 = (anchor - v0.center) / v0.halfSpan;
    const t1 = (anchor - v1.center) / v1.halfSpan;
    expect(t1).toBeCloseTo(t0, 9);
    expect(zoomViewNotch({ center: 0, halfSpan: 6 }, false, 0).halfSpan).toBe(6);
    expect(zoomViewNotch({ center: 0, halfSpan: 60 }, true, 0).halfSpan).toBe(60);
  });

  it('only uses discrete notch values', () => {
    const v = zoomViewNotch({ center: 2.3, halfSpan: 24 }, false, 0);
    expect(HALF_SPAN_NOTCHES).toContain(v.halfSpan);
  });
});

describe('panView', () => {
  it('shifts center, rounds to 0.5 dB, and clamps', () => {
    expect(panView({ center: 0, halfSpan: 24 }, 5)).toEqual({ center: 5, halfSpan: 24 });
    expect(panView({ center: 0, halfSpan: 24 }, 0.26)).toEqual({ center: 0.5, halfSpan: 24 });
    expect(panView({ center: 58, halfSpan: 24 }, 5)).toEqual({ center: 60, halfSpan: 24 });
  });
});

describe('ticksFor', () => {
  it('uses round steps within the visible range', () => {
    expect(ticksFor({ center: 0, halfSpan: 15 })).toEqual([-12, -8, -4, 0, 4, 8, 12]);
    const panned = ticksFor({ center: 5.5, halfSpan: 24 });
    expect(panned.length).toBeGreaterThanOrEqual(6);
    expect(panned.length).toBeLessThanOrEqual(10);
    for (const t of panned) {
      expect(t).toBeGreaterThanOrEqual(viewDbMin({ center: 5.5, halfSpan: 24 }) - 1e-6);
      expect(t).toBeLessThanOrEqual(viewDbMax({ center: 5.5, halfSpan: 24 }) + 1e-6);
      expect(Math.abs(t / 3 - Math.round(t / 3))).toBeLessThan(1e-6);
    }
    expect(viewDbMin({ center: 0, halfSpan: 24 })).toBe(-24);
    expect(viewDbMax({ center: 0, halfSpan: 24 })).toBe(24);
  });
});
