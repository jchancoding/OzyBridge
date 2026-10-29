// @ts-expect-error no @types/node in this repo; Vitest runs in node
import { readdirSync, readFileSync, statSync } from 'node:fs';
// @ts-expect-error no @types/node in this repo; Vitest runs in node
import { join } from 'node:path';
// @ts-expect-error no @types/node in this repo; Vitest runs in node
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DeviceCapabilities } from '../devices/types';
import { flatBand, profilesEqual, type EqProfile } from './eq';
import { formatBandLine, formatReport, overall, serializeVerifyDump, testPreset, verifyDumpFilename, type DeviceReport } from './report';

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

describe('formatBandLine', () => {
  it('formats a readable band line', () => {
    expect(formatBandLine({ type: 'PK', freq: 1000, gain: 3, q: 1, enabled: true })).toBe(
      'PK 1000 Hz +3.0 dB Q1.00',
    );
  });
});

describe('formatReport', () => {
  it('includes model and every step', () => {
    const r: DeviceReport = {
      schema: 2,
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
        { id: 'band', result: 'skipped' },
        { id: 'write', result: 'skipped', detail: 'n/a' },
        { id: 'readback', result: 'skipped' },
        { id: 'restart', result: 'skipped', detail: 'No restart' },
        { id: 'replug', result: 'skipped' },
        { id: 'restore', result: 'skipped' },
        { id: 'probe', result: 'skipped' },
      ],
      notes: '',
    };
    const text = formatReport(r);
    expect(text).toContain('FiiO BTR17');
    for (const s of r.steps) expect(text).toContain(s.id);
    expect(text).toContain('"schema": 2');
  });

  it('prints bands, raw hex, and descriptor', () => {
    const r: DeviceReport = {
      schema: 2,
      app: 'OzyBridge',
      browser: 'test',
      device: {
        name: 'Unknown',
        vendorId: '0x31B2',
        productId: '0x0001',
        firmware: null,
        listed: false,
        status: 'unlisted',
        descriptor: {
          productName: 'DSP Cable',
          vendorId: 0x31b2,
          productId: 1,
          collections: [{ usagePage: 0xff00, usage: 1, input: [1], output: [2], feature: [] }],
        },
      },
      steps: [
        {
          id: 'probe',
          result: 'pass',
          detail: 'descriptor recorded',
        },
        {
          id: 'read',
          result: 'pass',
          bands: ['PK 1000 Hz +3.0 dB Q1.00'],
          rawHex: ['out AA BB', 'in CC DD'],
        },
      ],
      notes: '',
    };
    const text = formatReport(r);
    expect(text).toContain('HID descriptor:');
    expect(text).toContain('out[2]');
    expect(text).toContain('PK 1000 Hz +3.0 dB Q1.00');
    expect(text).toContain('out AA BB');
  });
});

describe('verify dump', () => {
  const report: DeviceReport = {
    schema: 2,
    app: 'OzyBridge',
    browser: 'test',
    device: {
      name: 'Allegro Mini',
      vendorId: '0x31B2',
      productId: '0x0111',
      firmware: '1.0',
      listed: true,
      status: 'untested',
    },
    steps: [{ id: 'read', result: 'pass', rawHex: ['out 01'] }],
    notes: 'field note',
  };

  it('serializes a versioned JSON envelope', () => {
    const parsed = JSON.parse(serializeVerifyDump(report, 'Preamp: 0 dB\n'));
    expect(parsed.kind).toBe('ozybridge-verify-dump');
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.report).toEqual(report);
    expect(parsed.baselineAutoEq).toBe('Preamp: 0 dB');
  });

  it('names files from USB ids and date', () => {
    expect(verifyDumpFilename(report)).toMatch(/^ozybridge-verify-31b2-0111-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe('overall', () => {
  const base = (): DeviceReport => ({
    schema: 2,
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

describe('deviceVersion guard', () => {
  it('does not reference HIDDevice.deviceVersion under src/', () => {
    const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name === 'node_modules') continue;
          walk(path);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) continue;
        const text = readFileSync(path, 'utf8');
        if (/\bdeviceVersion\b/.test(text)) hits.push(path.slice(root.length + 1));
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});
