import type { DeviceCapabilities } from '../devices/types';
import { flatBand, profilesEqual, type EqBand, type EqProfile } from './eq';
import { commitNumber } from './step';

export type StepId = 'read' | 'write' | 'readback' | 'replug' | 'restore' | 'probe' | 'band' | 'restart';

export interface HidCollectionDescriptor {
  usagePage: number;
  usage: number;
  input: number[];
  output: number[];
  feature: number[];
}

export interface HidDeviceDescriptor {
  productName: string;
  vendorId: number;
  productId: number;
  collections: HidCollectionDescriptor[];
}

export interface ReportStep {
  id: StepId;
  result: 'pass' | 'fail' | 'skipped';
  detail?: string;
  bands?: string[];
  rawHex?: string[];
}

export interface DeviceReport {
  schema: 2;
  app: string;
  browser: string;
  device: {
    name: string | null;
    vendorId: string;
    productId: string;
    firmware: string | null;
    listed: boolean;
    status: 'verified' | 'untested' | 'unlisted';
    descriptor?: HidDeviceDescriptor;
  };
  steps: ReportStep[];
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

export function formatBandLine(b: EqBand): string {
  const gainStr = `${b.gain >= 0 ? '+' : ''}${b.gain.toFixed(1)}`;
  return `${b.type} ${b.freq} Hz ${gainStr} dB Q${b.q.toFixed(2)}`;
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

function formatDescriptor(d: HidDeviceDescriptor): string[] {
  const lines = ['HID descriptor:'];
  for (const [i, c] of d.collections.entries()) {
    const page = `0x${c.usagePage.toString(16)}/0x${c.usage.toString(16)}`;
    const part = (label: string, ids: number[]) => (ids.length ? ` ${label}[${ids.join(',')}]` : '');
    lines.push(
      `  collection ${i}: ${page}${part('in', c.input)}${part('out', c.output)}${part('feat', c.feature)}`,
    );
  }
  return lines;
}

export interface VerifyDump {
  kind: 'ozybridge-verify-dump';
  version: 1;
  exportedAt: string;
  report: DeviceReport;
  baselineAutoEq?: string;
}

export function buildVerifyDump(report: DeviceReport, baselineAutoEq?: string): VerifyDump {
  const trimmed = baselineAutoEq?.trimEnd();
  return {
    kind: 'ozybridge-verify-dump',
    version: 1,
    exportedAt: new Date().toISOString(),
    report,
    ...(trimmed ? { baselineAutoEq: trimmed } : {}),
  };
}

export function serializeVerifyDump(report: DeviceReport, baselineAutoEq?: string): string {
  return JSON.stringify(buildVerifyDump(report, baselineAutoEq), null, 2);
}

export function verifyDumpFilename(report: DeviceReport): string {
  const vid = report.device.vendorId.replace(/^0x/i, '').toLowerCase();
  const pid = report.device.productId.replace(/^0x/i, '').toLowerCase();
  const day = new Date().toISOString().slice(0, 10);
  return `ozybridge-verify-${vid}-${pid}-${day}.json`;
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
  ];
  if (r.device.descriptor) {
    lines.push(...formatDescriptor(r.device.descriptor));
  }
  lines.push('', 'Steps:');
  for (const s of r.steps) {
    const extra = s.detail ? ` — ${s.detail}` : '';
    lines.push(`  ${s.id}: ${s.result}${extra}`);
    for (const b of s.bands ?? []) lines.push(`    ${b}`);
    for (const h of s.rawHex ?? []) lines.push(`    ${h}`);
  }
  if (r.notes.trim()) {
    lines.push('', 'Notes:', r.notes.trim());
  }
  lines.push('', '---', JSON.stringify(r, null, 2));
  return lines.join('\n');
}
