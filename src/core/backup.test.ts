import { describe, expect, it } from 'vitest';
import { parseSlotBackup, serializeSlotBackup, type BackupSlot } from './backup';

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
