import { describe, expect, it } from 'vitest';
import { parseSlotBackup, planBackupImport, serializeSlotBackup, type BackupSlot, type SlotBackup } from './backup';
import { flatBand, type EqLimits, type EqProfile } from './eq';

const slots: BackupSlot[] = [
  { id: 5, label: 'USER 1', name: 'Warm', profile: { preamp: -2.5, bands: [{ type: 'PK', freq: 100, gain: 3, q: 1, enabled: true }] } },
  { id: 4, label: 'USER 2', name: '', profile: { preamp: 0, bands: [{ type: 'HSC', freq: 8000, gain: -1, q: 0.7, enabled: false }] } },
];
const exportedAt = '2026-10-27T00:00:00.000Z';
const good = () => JSON.parse(serializeSlotBackup({ product: 'BTR17', slots, exportedAt }));
const reject = (o: unknown) => parseSlotBackup(JSON.stringify(o));

describe('slot backup', () => {
  it('round trips and keeps slot order', () => {
    const r = parseSlotBackup(serializeSlotBackup({ product: 'BTR17', slots, exportedAt }));
    expect(r).toEqual({ ok: true, backup: { app: 'OzyBridge', kind: 'slot-backup', version: 1, product: 'BTR17', exportedAt, slots } });
    if (r.ok) expect(r.backup.slots.map((s) => s.id)).toEqual([5, 4]);
  });
  it('writes pretty JSON with header fields', () => {
    const text = serializeSlotBackup({ product: 'BTR17', slots, exportedAt });
    expect(text).toContain('\n  "app": "OzyBridge"');
    expect(good()).toMatchObject({ app: 'OzyBridge', kind: 'slot-backup', version: 1, product: 'BTR17', exportedAt });
  });
  it('rejects invalid JSON', () => {
    expect(parseSlotBackup('nope').ok).toBe(false);
  });
  it.each([
    ['app', (o: any) => { o.app = 'X'; }],
    ['kind', (o: any) => { o.kind = 'x'; }],
    ['version', (o: any) => { o.version = 2; }],
    ['product', (o: any) => { delete o.product; }],
    ['exportedAt', (o: any) => { delete o.exportedAt; }],
    ['slots', (o: any) => { delete o.slots; }],
    ['slot name', (o: any) => { delete o.slots[0].name; }],
    ['slot profile', (o: any) => { delete o.slots[0].profile; }],
    ['band value', (o: any) => { o.slots[0].profile.bands[0].gain = '3'; }],
    ['band type', (o: any) => { o.slots[0].profile.bands[0].type = 'XX'; }],
  ])('rejects bad %s', (_n, mutate) => {
    const o = good();
    mutate(o);
    const r = reject(o);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe('planBackupImport', () => {
  const limits: EqLimits = {
    maxBands: 3, filterTypes: ['PK', 'LSC', 'HSC'],
    gain: { min: -12, max: 12 }, preamp: { min: -24, max: 12 }, q: { min: 0.25, max: 8 }, freq: { min: 20, max: 20000 },
    step: { gain: 0.1, q: 0.01, freq: 1 }, defaultFreqs: [100, 1000, 10000],
  };
  const pkb = (gain: number) => ({ type: 'PK' as const, freq: 100, gain, q: 1, enabled: true });
  const backup = (product: string, list: BackupSlot[]): SlotBackup => ({ app: 'OzyBridge', kind: 'slot-backup', version: 1, product, exportedAt, slots: list });
  const mk = (id: number, preamp: number, gain: number): BackupSlot => ({ id, label: `USER ${id}`, name: `n${id}`, profile: { preamp, bands: [pkb(gain)] } });
  const flat: EqProfile = { preamp: 0, bands: [100, 1000, 10000].map(flatBand) };

  it('plans every slot, keeps the preamp as saved and marks unchanged slots', () => {
    const fitted = planBackupImport(backup('BTR17', [mk(1, -2, 5.8)]), 'BTR17', [1, 2], limits, {});
    expect(fitted.ok).toBe(true);
    if (!fitted.ok) return;
    const same = planBackupImport(backup('BTR17', [mk(1, -2, 5.8), mk(2, -1, 1)]), 'BTR17', [1, 2], limits, { 1: fitted.items[0]!.profile, 2: flat });
    expect(same.ok && same.items.map((i) => [i.id, i.changed, i.profile.preamp])).toEqual([[1, false, -2], [2, true, -1]]);
    expect(same.ok && same.items[0]!.warnings[0]).toContain('Clipping risk');
  });
  it('rejects another product, unknown slots, duplicates and unfittable EQs without partial plans', () => {
    const msgs = (b: SlotBackup, p = 'BTR17') => { const r = planBackupImport(b, p, [1, 2], limits, {}); return r.ok ? [] : r.errors; };
    expect(msgs(backup('KA15', [mk(1, 0, 0)]))[0]).toContain('for KA15');
    expect(msgs(backup('BTR17', [mk(9, 0, 0)]))[0]).toContain('no user slot 9');
    expect(msgs(backup('BTR17', [mk(1, 0, 0), mk(1, 0, 0)]))[0]).toContain('twice');
    expect(msgs(backup('BTR17', [mk(1, 0, 13)]))[0]).toContain('USER 1: Filter 1');
    expect(msgs(backup('BTR17', []))[0]).toContain('no slots');
  });
});
