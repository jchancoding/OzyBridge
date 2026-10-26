import type { EqBand, EqProfile } from './eq';

export interface Preset { id: string; name: string; profile: EqProfile; createdAt: string; source?: string }

const TYPES = ['PK', 'LSC', 'HSC'];
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function validBand(b: unknown): b is EqBand {
  if (typeof b !== 'object' || b === null) return false;
  const o = b as Record<string, unknown>;
  return TYPES.includes(o.type as string) && num(o.freq) && num(o.gain) && num(o.q) && typeof o.enabled === 'boolean';
}

function validPreset(e: unknown): e is Preset {
  if (typeof e !== 'object' || e === null) return false;
  const o = e as Record<string, unknown>;
  if (typeof o.id !== 'string' || o.id === '') return false;
  if (typeof o.name !== 'string' || o.name.trim() === '') return false;
  if (typeof o.createdAt !== 'string') return false;
  if (o.source !== undefined && typeof o.source !== 'string') return false;
  const p = o.profile as Record<string, unknown> | null;
  return typeof p === 'object' && p !== null && num(p.preamp) && Array.isArray(p.bands) && p.bands.every(validBand);
}

export function addPreset(list: Preset[], preset: Preset): Preset[] {
  return [...list, preset];
}

export function renamePreset(list: Preset[], id: string, name: string): Preset[] {
  return list.map((p) => (p.id === id ? { ...p, name } : p));
}

export function deletePreset(list: Preset[], id: string): Preset[] {
  return list.filter((p) => p.id !== id);
}

export function serializePresets(list: Preset[]): string {
  return JSON.stringify(list, null, 2);
}

export function parsePresets(text: string | null): Preset[] {
  if (!text) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  return Array.isArray(raw) ? raw.filter(validPreset) : [];
}

// Incoming entries replace existing ones with the same id in place; new ids are appended.
export function mergePresets(existing: Preset[], incoming: Preset[]): Preset[] {
  const byId = new Map(incoming.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const out = existing.map((p) => {
    seen.add(p.id);
    return byId.get(p.id) ?? p;
  });
  for (const p of incoming) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}
