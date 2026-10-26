import { describe, expect, it } from 'vitest';
import ka15 from './__fixtures__/fiio_fiio_ka15.json';
import melody from './__fixtures__/fiio_snowsky_melody.json';
import { FIIO_VENDOR_ID, findFiioModel } from './models';
import { CMD, decodeBandPayload, decodeGain, parseReply } from './protocol';

// devicePEQ captures: `sequence` holds the device's replies to a full read; `exchanges` holds a
// write session, where some models echo sets as AA 0A frames that are not replies.
interface Capture { sequence: { data: number[] }[] }
const replies = (c: Capture) => c.sequence.map((r) => parseReply(Uint8Array.from(r.data)));

const writableIds = (pid: number) =>
  findFiioModel(FIIO_VENDOR_ID, pid)!.capabilities.slots.filter((s) => s.writable).map((s) => s.id);

function decodeCapture(c: Capture) {
  const rs = replies(c);
  expect(rs.every((r) => r !== null)).toBe(true);
  const ok = rs.filter((r) => r !== null);
  const one = (cmd: number) => ok.find((r) => r.cmd === cmd)!.payload;
  const preamp = one(CMD.GLOBAL_GAIN);
  return {
    count: one(CMD.PEQ_COUNT)[0],
    active: one(CMD.PEQ_PRE)[0],
    preamp: decodeGain(preamp[0]!, preamp[1]!),
    bands: ok.filter((r) => r.cmd === CMD.PEQ_PARAMS).map((r) => decodeBandPayload(r.payload)),
  };
}

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

  it('leaves BTR17 untouched', () => {
    expect(findFiioModel(FIIO_VENDOR_ID, 0x0088)!.untested).toBeUndefined();
  });
});

describe('devicePEQ captures decode with our protocol', () => {
  it('KA15 read session', () => {
    const d = decodeCapture(ka15 as Capture);
    const m = findFiioModel(FIIO_VENDOR_ID, 0x0104)!;
    expect(d.count).toBe(m.capabilities.maxBands);
    expect(writableIds(0x0104)).toContain(d.active);
    expect(d.preamp).toBe(0);
    expect(d.bands.map((b) => b.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(d.bands[0]!.band).toMatchObject({ type: 'PK', freq: 20, gain: 4.2, q: 0.6 });
  });

  it('SNOWSKY Melody read session', () => {
    const d = decodeCapture(melody as Capture);
    expect(d.count).toBe(findFiioModel(FIIO_VENDOR_ID, 0x0126)!.capabilities.maxBands);
    expect(d.preamp).toBe(-4);
    expect(d.bands.map((b) => b.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(d.bands[0]!.band).toMatchObject({ type: 'PK', freq: 32, gain: 3, q: 0.71 });
  });
});
