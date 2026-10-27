import type { DeviceCapabilities } from '../devices/types';
import { flatBand, profilesEqual, type EqBand, type EqProfile } from './eq';
import { commitNumber } from './step';

export type StepId = 'read' | 'write' | 'readback' | 'replug' | 'restore' | 'probe';

export interface DeviceReport {
  schema: 1;
  app: string;
  browser: string;
  device: {
    name: string | null;
    vendorId: string;
    productId: string;
    firmware: string | null;
    listed: boolean;
    status: 'verified' | 'untested' | 'unlisted';
  };
  steps: { id: StepId; result: 'pass' | 'fail' | 'skipped'; detail?: string }[];
  notes: string;
}

function clamp(value: number, step: number, range: { min: number; max: number }): number {
  const c = commitNumber(String(value), step, range);
  return c.ok ? c.value : value;
}

function targetBand(caps: DeviceCapabilities, gain: number): EqBand {
  const type = caps.filterTypes.includes('PK') ? 'PK' : caps.filterTypes[0]!;
  return {
    type,
    freq: clamp(1000, caps.step.freq, caps.freq),
    gain: clamp(gain, caps.step.gain, caps.gain),
    q: clamp(1, caps.step.q, caps.q),
    enabled: true,
  };
}

export function testPreset(caps: DeviceCapabilities, current: EqProfile): EqProfile {
  let band = targetBand(caps, 3);
  const cur0 = current.bands[0];
  if (cur0 && profilesEqual({ preamp: current.preamp, bands: [cur0] }, { preamp: current.preamp, bands: [band] })) {
    band = targetBand(caps, -3);
  }
  const bands =
    current.bands.length > 0
      ? [...current.bands]
      : Array.from({ length: caps.maxBands }, () => flatBand(band.freq));
  bands[0] = band;
  while (bands.length < caps.maxBands) bands.push(flatBand(band.freq));
  return { preamp: current.preamp, bands: bands.slice(0, caps.maxBands) };
}

export function overall(r: DeviceReport): 'pass' | 'fail' | 'partial' {
  const results = r.steps.map((s) => s.result);
  const hasPass = results.includes('pass');
  const hasFail = results.includes('fail');
  if (hasPass && hasFail) return 'partial';
  if (hasFail) return 'fail';
  return 'pass';
}

export function formatReport(r: DeviceReport): string {
  const lines: string[] = [
    'OzyBridge device report',
    `Overall: ${overall(r)}`,
    '',
    `Device: ${r.device.name ?? '(unknown)'}`,
    `Vendor ID: ${r.device.vendorId}`,
    `Product ID: ${r.device.productId}`,
    `Firmware: ${r.device.firmware ?? 'unknown'}`,
    `Listed: ${r.device.listed ? 'yes' : 'no'} (${r.device.status})`,
    '',
    'Steps:',
  ];
  for (const s of r.steps) {
    const extra = s.detail ? ` — ${s.detail}` : '';
    lines.push(`  ${s.id}: ${s.result}${extra}`);
  }
  if (r.notes.trim()) {
    lines.push('', 'Notes:', r.notes.trim());
  }
  lines.push('', '---', JSON.stringify(r, null, 2));
  return lines.join('\n');
}
