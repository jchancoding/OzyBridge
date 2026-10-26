import type { EqProfile } from './eq';

export interface NamedSlot { slot: number; name: string; fp: string }
export type SlotNames = Record<string, NamedSlot[]>;

const HISTORY = 60;

// Flat and disabled bands are ignored so padding differences do not change the fingerprint.
export function fingerprint(p: EqProfile): string {
  const bands = p.bands
    .filter((b) => b.enabled && b.gain !== 0)
    .map((b) => `${b.type}:${b.freq.toFixed(0)}:${b.gain.toFixed(1)}:${b.q.toFixed(2)}`);
  return `${p.preamp.toFixed(1)}|${bands.join(',')}`;
}

export function isFlat(p: EqProfile): boolean {
  return fingerprint(p).endsWith('|') && p.preamp === 0;
}

export function parseSlotNames(json: string | null): SlotNames {
  if (!json) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return {};
  }
  const out: SlotNames = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [product, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    out[product] = list.filter(
      (e): e is NamedSlot =>
        typeof e === 'object' && e !== null && Number.isInteger(e.slot) &&
        typeof e.name === 'string' && e.name.trim() !== '' && typeof e.fp === 'string',
    );
  }
  return out;
}

export function serializeSlotNames(all: SlotNames): string {
  return JSON.stringify(all, null, 2);
}

// Name per slot id. Same slot and same bands wins; otherwise the newest entry with the same bands
// (the preset moved or was changed elsewhere). Unknown bands get no name.
export function matchSlotNames(entries: NamedSlot[], profiles: Record<number, EqProfile>): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [id, p] of Object.entries(profiles)) {
    if (isFlat(p)) continue;
    const fp = fingerprint(p);
    const same = entries.filter((e) => e.fp === fp);
    const hit = same.find((e) => e.slot === Number(id)) ?? same[same.length - 1];
    if (hit) out[Number(id)] = hit.name;
  }
  return out;
}

// Records `name` for the slot's current bands. An empty name removes it.
export function renameSlot(all: SlotNames, product: string, slot: number, profile: EqProfile, name: string): SlotNames {
  const fp = fingerprint(profile);
  const rest = (all[product] ?? []).filter((e) => !(e.slot === slot && e.fp === fp));
  const clean = name.trim();
  const next = clean ? [...rest, { slot, name: clean, fp }] : rest;
  return { ...all, [product]: next.slice(-HISTORY) };
}
