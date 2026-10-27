import type { EqBand, EqLimits, EqProfile, FilterType } from './eq';
import { profilesEqual } from './eq';
import { fitProfile } from './fit';

export interface BackupSlot { id: number; label: string; name: string; profile: EqProfile }
export interface SlotBackup { app: 'OzyBridge'; kind: 'slot-backup'; version: 1; product: string; exportedAt: string; slots: BackupSlot[] }

export type ParseBackupResult = { ok: true; backup: SlotBackup } | { ok: false; errors: string[] };

export function serializeSlotBackup(input: { product: string; slots: BackupSlot[]; exportedAt: string }): string {
  const backup: SlotBackup = {
    app: 'OzyBridge',
    kind: 'slot-backup',
    version: 1,
    product: input.product,
    exportedAt: input.exportedAt,
    slots: input.slots.map((s) => ({
      id: s.id,
      label: s.label,
      name: s.name,
      profile: {
        preamp: s.profile.preamp,
        bands: s.profile.bands.map((b) => ({ type: b.type, freq: b.freq, gain: b.gain, q: b.q, enabled: b.enabled })),
      },
    })),
  };
  return JSON.stringify(backup, null, 2);
}

const TYPES: FilterType[] = ['PK', 'LSC', 'HSC'];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function parseSlotBackup(text: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['This file is not valid JSON.'] };
  }
  if (!isObj(raw)) return { ok: false, errors: ['This file is not an OzyBridge slot backup.'] };
  const errors: string[] = [];
  if (raw.app !== 'OzyBridge') errors.push('This file was not made by OzyBridge.');
  if (raw.kind !== 'slot-backup') errors.push('This file is not a slot backup.');
  if (raw.version !== 1) errors.push('Unsupported backup version. Only version 1 is supported.');
  if (typeof raw.product !== 'string' || raw.product === '') errors.push('The product name is missing.');
  if (typeof raw.exportedAt !== 'string' || raw.exportedAt === '') errors.push('The export date is missing.');
  if (!Array.isArray(raw.slots)) {
    errors.push('The slot list is missing.');
    return { ok: false, errors };
  }
  const slots: BackupSlot[] = [];
  raw.slots.forEach((s: unknown, i) => {
    const at = `Slot ${i + 1}`;
    if (!isObj(s)) { errors.push(`${at} is not an object.`); return; }
    if (!isNum(s.id)) errors.push(`${at}: id must be a number.`);
    if (typeof s.label !== 'string') errors.push(`${at}: label is missing.`);
    if (typeof s.name !== 'string') errors.push(`${at}: name is missing.`);
    const p = s.profile;
    if (!isObj(p) || !isNum(p.preamp) || !Array.isArray(p.bands)) {
      errors.push(`${at}: EQ profile needs a numeric preamp and a list of bands.`);
      return;
    }
    const bands: EqBand[] = [];
    p.bands.forEach((b: unknown, j) => {
      const bat = `${at}, band ${j + 1}`;
      if (!isObj(b)) { errors.push(`${bat} is not an object.`); return; }
      if (!TYPES.includes(b.type as FilterType)) errors.push(`${bat}: filter type must be PK, LSC or HSC.`);
      for (const k of ['freq', 'gain', 'q'] as const) {
        if (!isNum(b[k])) errors.push(`${bat}: ${k} must be a number.`);
      }
      if (typeof b.enabled !== 'boolean') errors.push(`${bat}: enabled must be true or false.`);
      bands.push(b as unknown as EqBand);
    });
    slots.push({ id: s.id as number, label: s.label as string, name: s.name as string, profile: { preamp: p.preamp, bands } });
  });
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    backup: { app: 'OzyBridge', kind: 'slot-backup', version: 1, product: raw.product as string, exportedAt: raw.exportedAt as string, slots },
  };
}

export interface RestoreItem { id: number; name: string; profile: EqProfile; changed: boolean; notes: string[]; warnings: string[] }
export type RestorePlan = { ok: true; items: RestoreItem[] } | { ok: false; errors: string[] };

// Checks a whole backup against the device before anything is written. Any problem rejects the lot,
// so a restore never leaves the device half done because of a file error.
export function planBackupImport(
  backup: SlotBackup,
  product: string,
  slotIds: number[],
  limits: EqLimits,
  current: Record<number, EqProfile>,
): RestorePlan {
  if (backup.product !== product) {
    return { ok: false, errors: [`This backup is for ${backup.product}, but the connected device is ${product}.`] };
  }
  const errors: string[] = [];
  const items: RestoreItem[] = [];
  const seen = new Set<number>();
  for (const s of backup.slots) {
    const at = s.label || `Slot ${s.id}`;
    if (!slotIds.includes(s.id)) { errors.push(`${at}: this device has no user slot ${s.id}.`); continue; }
    if (seen.has(s.id)) { errors.push(`${at}: slot ${s.id} appears twice in the file.`); continue; }
    seen.add(s.id);
    const fit = fitProfile(s.profile, limits);
    if (!fit.ok) { fit.errors.forEach((e) => errors.push(`${at}: ${e.message}`)); continue; }
    const now = current[s.id];
    items.push({
      id: s.id,
      name: s.name,
      profile: fit.profile,
      changed: !now || !profilesEqual(now, fit.profile),
      notes: fit.notes,
      warnings: fit.warnings,
    });
  }
  if (items.length === 0 && errors.length === 0) errors.push('This backup has no slots.');
  return errors.length ? { ok: false, errors } : { ok: true, items };
}
