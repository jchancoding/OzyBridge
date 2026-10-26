import { describe, expect, it } from 'vitest';
import type { EqProfile } from './eq';
import { addPreset, deletePreset, mergePresets, parsePresets, renamePreset, serializePresets, type Preset } from './presets';

const prof: EqProfile = { preamp: -2, bands: [{ type: 'PK', freq: 100, gain: 3, q: 1, enabled: true }] };
const mk = (id: string, name = id): Preset => ({ id, name, profile: prof, createdAt: '2026-01-01T00:00:00Z' });

describe('presets', () => {
  it('adds without mutating', () => {
    const a = [mk('a')];
    const b = addPreset(a, mk('b'));
    expect(a).toHaveLength(1);
    expect(b.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('renames only the target', () => {
    const a = [mk('a'), mk('b')];
    const b = renamePreset(a, 'b', 'New');
    expect(b.map((p) => p.name)).toEqual(['a', 'New']);
    expect(a[1]?.name).toBe('b');
  });

  it('deletes by id', () => {
    const a = [mk('a'), mk('b')];
    expect(deletePreset(a, 'a').map((p) => p.id)).toEqual(['b']);
    expect(a).toHaveLength(2);
  });

  it('round-trips through JSON', () => {
    const a = [mk('a'), { ...mk('b'), source: 'file.txt' }];
    expect(parsePresets(serializePresets(a))).toEqual(a);
  });

  it('returns [] for missing or bad input', () => {
    expect(parsePresets(null)).toEqual([]);
    expect(parsePresets('')).toEqual([]);
    expect(parsePresets('{nope')).toEqual([]);
    expect(parsePresets('{"a":1}')).toEqual([]);
  });

  it('drops malformed entries and keeps valid ones in order', () => {
    const bad = [
      null,
      { ...mk('x'), name: '  ' },
      { ...mk('y'), id: '' },
      { ...mk('z'), profile: { preamp: 'a', bands: [] } },
      { ...mk('w'), profile: { preamp: 0, bands: [{ type: 'XX', freq: 1, gain: 0, q: 1, enabled: true }] } },
      { ...mk('v'), source: 5 },
    ];
    const text = JSON.stringify([mk('a'), ...bad, mk('b')]);
    expect(parsePresets(text).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('merges by id, incoming wins, order kept', () => {
    const existing = [mk('a', 'old a'), mk('b'), mk('c')];
    const incoming = [mk('d'), mk('b', 'new b')];
    const out = mergePresets(existing, incoming);
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(out[1]?.name).toBe('new b');
    expect(existing[1]?.name).toBe('b');
  });
});
