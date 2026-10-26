import { describe, expect, it } from 'vitest';
import a2000 from './__fixtures__/autoeq-a2000-10band.txt?raw';
import { exportAutoEq, parseAutoEq } from './autoeq';
import type { EqProfile } from './eq';

function ok(text: string) {
  const r = parseAutoEq(text);
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('\n'));
  return r;
}

function errs(text: string) {
  const r = parseAutoEq(text);
  if (r.ok) throw new Error('expected failure');
  return r.errors;
}

describe('parseAutoEq', () => {
  it('parses the A2000 fixture', () => {
    const r = ok(a2000);
    expect(r.name).toBeNull();
    expect(r.notes).toEqual([]);
    expect(r.profile.preamp).toBe(-6.9);
    expect(r.profile.bands).toHaveLength(10);
    expect(r.profile.bands[0]).toEqual({ type: 'LSC', freq: 22, gain: 6.61, q: 0.73, enabled: true });
    expect(r.profile.bands[9]).toEqual({ type: 'PK', freq: 15329, gain: -4.6, q: 0.887, enabled: true });
    expect(r.profile.bands.map((b) => b.type)).toEqual([
      'LSC', 'PK', 'PK', 'PK', 'PK', 'PK', 'PK', 'PK', 'HSC', 'PK',
    ]);
  });

  it('round trips', () => {
    const p = ok(a2000).profile;
    expect(parseAutoEq(exportAutoEq(p))).toEqual({ ok: true, profile: p, name: null, notes: [] });
    const withOff: EqProfile = {
      preamp: -2.5,
      bands: [
        { type: 'PK', freq: 100, gain: -3, q: 1.2, enabled: true },
        { type: 'HSC', freq: 8000, gain: 2, q: 0.7, enabled: false },
      ],
    };
    expect(parseAutoEq(exportAutoEq(withOff))).toEqual({ ok: true, profile: withOff, name: null, notes: [] });
  });

  it('exports an exact string', () => {
    const s = exportAutoEq({
      preamp: -3.456,
      bands: [
        { type: 'LSC', freq: 42.04, gain: 6, q: 0.8704, enabled: true },
        { type: 'PK', freq: 1000, gain: -1.234, q: 1, enabled: false },
      ],
    });
    expect(s).toBe(
      'Preamp: -3.46 dB\n' +
        'Filter 1: ON LSC Fc 42 Hz Gain 6 dB Q 0.87\n' +
        'Filter 2: OFF PK Fc 1000 Hz Gain -1.23 dB Q 1\n',
    );
  });

  it('handles padding, CRLF, lowercase, plus signs and aliases', () => {
    const text = [
      'Filter Settings file',
      'Room EQ V5.31',
      '# comment',
      'Preamp: +1.5 dB',
      'Filter  1: ON  PK       Fc   63.0 Hz  Gain  -2.0 dB  Q  1.410',
      'filter 2: on lsq fc +100 hz gain +3 db q 0.7',
      'Filter 3: ON HS Fc 8000 Hz Gain 1 dB Q 0.5',
      'Filter 4: ON PEQ Fc 500 Hz Gain 1 dB Q 2',
      'Filter 5: ON None',
    ].join('\r\n');
    const r = ok(text);
    expect(r.profile.preamp).toBe(1.5);
    expect(r.profile.bands).toEqual([
      { type: 'PK', freq: 63, gain: -2, q: 1.41, enabled: true },
      { type: 'LSC', freq: 100, gain: 3, q: 0.7, enabled: true },
      { type: 'HSC', freq: 8000, gain: 1, q: 0.5, enabled: true },
      { type: 'PK', freq: 500, gain: 1, q: 2, enabled: true },
    ]);
  });

  it('parses OFF filters and skips unreadable ones', () => {
    const r = ok('Filter 1: ON PK Fc 100 Hz Gain 1 dB Q 1\nFilter 2: OFF PK Fc 200 Hz Gain 1 dB Q 1\nFilter 3: OFF LP Fc 200 Hz\n');
    expect(r.profile.bands).toHaveLength(2);
    expect(r.profile.bands[1]?.enabled).toBe(false);
    expect(r.notes).toHaveLength(1);
  });

  it('rejects unsupported types', () => {
    const e = errs('Filter 1: ON LP Fc 100 Hz Gain 0 dB Q 1\nFilter 2: ON LS 6dB Fc 100 Hz Gain 1 dB\nFilter 3: ON XX Fc 1 Hz Gain 0 dB Q 1');
    expect(e.map((x) => x.line)).toEqual([1, 2, 3]);
    expect(e[0]?.message).toBe(
      "Line 1: low-pass filters (LP) aren't supported. Use peak (PK), low shelf (LSC) or high shelf (HSC).",
    );
    expect(e[1]?.message).toContain('fixed-slope shelf');
  });

  it('rejects BW', () => {
    const e = errs('Filter 1: ON PK Fc 100 Hz Gain 1 dB BW Oct 0.5');
    expect(e).toHaveLength(1);
    expect(e[0]?.message).toContain('Q values');
  });

  it('rejects missing Q', () => {
    const e = errs('Filter 1: ON PK Fc 100 Hz Gain 1 dB');
    expect(e).toHaveLength(1);
    expect(e[0]?.message).toContain('Q');
    expect(e[0]?.line).toBe(1);
  });

  it('rejects two Preamp lines', () => {
    const e = errs('Preamp: -1 dB\nPreamp: -2 dB\nFilter 1: ON PK Fc 100 Hz Gain 1 dB Q 1');
    expect(e).toHaveLength(1);
    expect(e[0]?.line).toBe(2);
  });

  it('rejects malformed lines', () => {
    const e = errs('Filter 1: ON\nFilter 2 ON PK');
    expect(e.map((x) => x.line)).toEqual([1, 2]);
  });

  it('rejects files with no filters', () => {
    for (const t of ['', 'Preamp: -1 dB\n', 'Filter 1: ON None\nFilter 2: OFF PK Fc 1 Hz Gain 1 dB Q 1']) {
      const r = t.includes('OFF') ? parseAutoEq(t) : parseAutoEq(t);
      if (t.includes('OFF')) {
        expect(r.ok).toBe(false);
      }
      expect(errs(t)[0]?.message).toBe(
        'No filters found. Paste or drop a parametric EQ text file (AutoEQ, Squiglink or REW format).',
      );
    }
  });

  it('reports multiple problems with line numbers', () => {
    const e = errs(
      ['Preamp: 0 dB', 'Filter 1: ON PK Fc 100 Hz Gain 1 dB Q 1', 'Filter 2: ON HP Fc 20 Hz', 'Filter 3: ON PK Fc 100 Hz Gain 1 dB', 'Preamp: 1 dB', 'Filter 5: ON PK Fc 0 Hz Gain 1 dB Q 1'].join('\n'),
    );
    expect(e.map((x) => x.line)).toEqual([3, 4, 5, 6]);
  });
});

describe('Squiglink', () => {
  it('rejects two-channel files', () => {
    const t = ['Channel: L', 'Preamp: -1 dB', 'Filter 1: ON PK Fc 100 Hz Gain 1 dB Q 1', 'Filter 2: ON PK Fc 200 Hz Gain 1 dB Q 1',
      'Channel: R', 'Preamp: -1 dB', 'Filter 1: ON PK Fc 100 Hz Gain 1 dB Q 1', 'Filter 2: ON PK Fc 200 Hz Gain 1 dB Q 1'].join('\n');
    expect(errs(t)).toEqual([{
      line: 1,
      message: 'This file has separate EQ for the left and right channels. OzyControl applies one EQ to both channels. Turn off two-channel EQ in Squiglink and export again.',
    }]);
  });

  it('parses one-channel CRLF output', () => {
    const t = ['Preamp: -3.1234 dB', 'Filter 1: ON LSC Fc 105 Hz Gain 4.5000 dB Q 0.7000', 'Filter 2: ON HSC Fc 8000 Hz Gain -2.2500 dB Q 0.5000', ''].join('\r\n');
    const r = ok(t);
    expect(r.profile.preamp).toBe(-3.1234);
    expect(r.profile.bands).toEqual([
      { type: 'LSC', freq: 105, gain: 4.5, q: 0.7, enabled: true },
      { type: 'HSC', freq: 8000, gain: -2.25, q: 0.5, enabled: true },
    ]);
  });
});

describe('exportAutoEq omitFlat', () => {
  const p: EqProfile = {
    preamp: -1,
    bands: [
      { type: 'PK', freq: 100, gain: 0, q: 1, enabled: true },
      { type: 'PK', freq: 200, gain: 2, q: 1, enabled: true },
      { type: 'PK', freq: 300, gain: 3, q: 1, enabled: false },
      { type: 'HSC', freq: 400, gain: -1, q: 1, enabled: true },
    ],
  };
  it('drops flat and disabled bands and renumbers', () => {
    const lines = exportAutoEq(p, { omitFlat: true }).trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^Filter 1: ON PK Fc 200 /);
    expect(lines[2]).toMatch(/^Filter 2: ON HSC Fc 400 /);
  });
  it('keeps them by default', () => {
    expect(exportAutoEq(p).trim().split('\n')).toHaveLength(5);
  });
});
