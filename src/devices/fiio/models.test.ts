import { describe, expect, it } from 'vitest';
import ka15 from './__fixtures__/fiio_fiio_ka15.json';
import melody from './__fixtures__/fiio_snowsky_melody.json';
import oak from './__fixtures__/fiio_fiio_oak_nano.json';
import { FIIO_VENDOR_ID, findFiioModel } from './models';
import { decodeBandPayload, decodeGain, parseReply } from './protocol';

interface Capture { exchanges: { responses?: { data: number[] }[] }[] }
const frames = (c: Capture) => c.exchanges.flatMap((e) => (e.responses ?? []).map((r) => Uint8Array.from(r.data)));
const writableIds = (pid: number) =>
  findFiioModel(FIIO_VENDOR_ID, pid)!.capabilities.slots.filter((s) => s.writable).map((s) => s.id);

describe('devicePEQ models', () => {
  it('KA15', () => {
    const m = findFiioModel(FIIO_VENDOR_ID, 0x0104)!;
    expect(m.name).toBe('FiiO KA15');
    expect(m.untested).toBe(true);
    expect(writableIds(0x0104)).toEqual([7, 8, 9]);
    expect(m.capabilities.eqOffSlotId).toBe(10);
    expect(m.capabilities.gain).toEqual({ min: -12, max: 12 });
    expect(m.capabilities.preamp).toEqual({ min: -12, max: 12 });
    expect(m.capabilities.slots.slice(0, 7).every((s) => !s.writable)).toBe(true);
  });

  it('SNOWSKY Melody', () => {
    const m = findFiioModel(FIIO_VENDOR_ID, 0x0126)!;
    expect(m.name).toBe('SNOWSKY Melody');
    expect(m.untested).toBe(true);
    expect(writableIds(0x0126)).toEqual([160, 161, 162]);
    expect(m.capabilities.eqOffSlotId).toBe(240);
    expect(m.capabilities.gain).toEqual({ min: -12, max: 12 });
  });

  it('Oak Nano', () => {
    const m = findFiioModel(FIIO_VENDOR_ID, 0x4016)!;
    expect(m.name).toBe('FiiO Oak Nano');
    expect(m.untested).toBe(true);
    expect(writableIds(0x4016)).toEqual([160]);
    expect(m.capabilities.eqOffSlotId).toBeNull();
    expect(m.capabilities.gain).toEqual({ min: -24, max: 12 });
    expect(m.capabilities.preamp).toEqual({ min: -24, max: 12 });
  });

  it('leaves BTR17 untouched', () => {
    expect(findFiioModel(FIIO_VENDOR_ID, 0x0088)!.untested).toBeUndefined();
  });
});

describe('devicePEQ captures', () => {
  it('Oak Nano replies parse and decode', () => {
    const replies = frames(oak as Capture).map((f) => parseReply(f)!);
    expect(replies.every((r) => r !== null)).toBe(true);
    const preamp = replies.find((r) => r.cmd === 0x17)!;
    expect(decodeGain(preamp.payload[0]!, preamp.payload[1]!)).toBe(12);
    const byIndex = new Map(
      replies.filter((r) => r.cmd === 0x15).map((r) => decodeBandPayload(r.payload)).map((b) => [b.index, b.band]),
    );
    expect([...byIndex.keys()].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(byIndex.get(0)).toMatchObject({ type: 'PK', freq: 64, gain: 0, q: 0.71 });
    expect(byIndex.get(1)).toMatchObject({ freq: 250, gain: 0, q: 0.71 });
    expect(byIndex.get(3)).toMatchObject({ freq: 1000, q: 0.71 });
  });

  // Open issue: KA15 pull replies are AA 0A frames (write-style header), which parseReply rejects.
  it('KA15 replies are AA 0A frames that parseReply rejects', () => {
    const real = frames(ka15 as Capture).filter((f) => f[0] !== 0);
    expect(real.length).toBeGreaterThan(0);
    expect(real.every((f) => f[0] === 0xaa && f[1] === 0x0a)).toBe(true);
    expect(real.every((f) => parseReply(f) === null)).toBe(true);
  });

  it('Melody capture contains no device replies', () => {
    expect(frames(melody as Capture)).toHaveLength(0);
  });
});
