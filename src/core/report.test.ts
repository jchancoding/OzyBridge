import { describe, expect, it } from 'vitest';
import type { DeviceCapabilities } from '../devices/types';
import { flatBand, profilesEqual, type EqProfile } from './eq';
import { formatReport, overall, testPreset, type DeviceReport } from './report';

const caps: DeviceCapabilities = {
  maxBands: 10,
  filterTypes: ['PK', 'LSC', 'HSC'],
  gain: { min: -12, max: 12 },
  preamp: { min: -12, max: 12 },
  q: { min: 0.25, max: 8 },
  freq: { min: 20, max: 20000 },
  step: { gain: 0.1, q: 0.01, freq: 1 },
  slots: [{ id: 0, label: 'USER', writable: true }],
  eqOffSlotId: null,
};

function profile(band0 = flatBand(500)): EqProfile {
  return {
    preamp: 0,
    bands: Array.from({ length: 10 }, (_, i) => (i === 0 ? band0 : flatBand(100 * (i + 1)))),
  };
}

describe('testPreset', () => {
  it('sets PK at 1 kHz, +3 dB, Q 1', () => {
    const cur = profile();
    const next = testPreset(caps, cur);
    expect(next.bands[0]).toMatchObject({ type: 'PK', freq: 1000, gain: 3, q: 1, enabled: true });
    expect(profilesEqual(next, cur)).toBe(false);
  });

  it('clamps gain and freq to device limits', () => {
    const tight: DeviceCapabilities = {
      ...caps,
      gain: { min: -2, max: 2 },
      freq: { min: 500, max: 800 },
    };
    const next = testPreset(tight, profile());
    expect(next.bands[0]!.gain).toBe(2);
    expect(next.bands[0]!.freq).toBe(800);
  });

  it('uses -3 dB when +3 already matches band 0', () => {
    const cur = profile({ type: 'PK', freq: 1000, gain: 3, q: 1, enabled: true });
    const next = testPreset(caps, cur);
    expect(next.bands[0]!.gain).toBe(-3);
  });

  it('falls back to first allowed filter type when PK is unsupported', () => {
    const lscOnly: DeviceCapabilities = { ...caps, filterTypes: ['LSC', 'HSC'] };
    const next = testPreset(lscOnly, profile());
    expect(next.bands[0]!.type).toBe('LSC');
  });
});

describe('formatReport', () => {
  it('includes model and every step', () => {
    const r: DeviceReport = {
      schema: 1,
      app: 'OzyBridge',
      browser: 'test',
      device: {
        name: 'FiiO BTR17',
        vendorId: '0x2972',
        productId: '0x0088',
        firmware: '1.0',
        listed: true,
        status: 'verified',
      },
      steps: [
        { id: 'read', result: 'pass' },
        { id: 'write', result: 'skipped', detail: 'n/a' },
        { id: 'readback', result: 'skipped' },
        { id: 'replug', result: 'skipped' },
        { id: 'restore', result: 'skipped' },
        { id: 'probe', result: 'skipped' },
      ],
      notes: '',
    };
    const text = formatReport(r);
    expect(text).toContain('FiiO BTR17');
    for (const s of r.steps) expect(text).toContain(s.id);
    expect(text).toContain('"schema": 1');
  });
});

describe('overall', () => {
  const base = (): DeviceReport => ({
    schema: 1,
    app: 'OzyBridge',
    browser: 'x',
    device: {
      name: 'x',
      vendorId: '0',
      productId: '0',
      firmware: null,
      listed: false,
      status: 'unlisted',
    },
    steps: [],
    notes: '',
  });

  it('passes when no failures', () => {
    expect(overall({ ...base(), steps: [{ id: 'read', result: 'pass' }, { id: 'write', result: 'skipped' }] })).toBe(
      'pass',
    );
  });
  it('fails when only failures', () => {
    expect(overall({ ...base(), steps: [{ id: 'read', result: 'fail' }] })).toBe('fail');
  });
  it('partial when mixed', () => {
    expect(
      overall({ ...base(), steps: [{ id: 'read', result: 'pass' }, { id: 'write', result: 'fail' }] }),
    ).toBe('partial');
  });
});
