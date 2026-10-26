import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EqBand, EqProfile } from '../../core/eq';
import { ProtocolError, UnsupportedDeviceError, WriteVerifyError } from '../types';
import { connectFiio, DEFAULT_FIIO_TIMING } from './adapter';
import { FakeFiioHid } from './fakeFiioHid';
import { FIIO_MODELS, pickFiioInterface } from './models';

const FORBIDDEN = new Set([0x21, 0x1b, 0x1c, 0x30]);
const fakes: FakeFiioHid[] = [];
const ZERO = { bandGapMs: 0, setGapMs: 0, afterPreampMs: 0, afterSaveMs: 0 };

function makeFake(): FakeFiioHid {
  const f = new FakeFiioHid();
  fakes.push(f);
  return f;
}

afterEach(() => {
  vi.useRealTimers();
  for (const f of fakes.splice(0)) {
    expect(f.sent.filter((s) => FORBIDDEN.has(s.cmd))).toEqual([]);
  }
});

const band = (freq: number, gain = 0, over: Partial<EqBand> = {}): EqBand => ({
  type: 'PK', freq, gain, q: 1, enabled: true, ...over,
});
const FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const profile = (over: Partial<EqProfile> = {}): EqProfile => ({
  preamp: -3.5,
  bands: FREQS.map((f, i) => band(f, i - 4.5)),
  ...over,
});

async function connect(f: FakeFiioHid, extra = {}) {
  return connectFiio(f.asHid(), { timing: ZERO, hid: new EventTarget(), ...extra });
}

const FW_PID = 0xfffe;
beforeAll(() => {
  FIIO_MODELS.push({ ...FIIO_MODELS[0]!, productId: FW_PID, firmwareCmd: true });
});
afterAll(() => {
  FIIO_MODELS.splice(FIIO_MODELS.findIndex((m) => m.productId === FW_PID), 1);
});
const fwFake = () => Object.assign(makeFake(), { productId: FW_PID });

describe('connectFiio', () => {
  it('reads only the band count on the BTR17, which does not answer firmware requests', async () => {
    const f = makeFake();
    const a = await connect(f);
    expect(a.info.firmware).toBeNull();
    expect(f.sent.map((s) => s.cmd)).toEqual([0x18]);
  });

  it('reads firmware on models that support it', async () => {
    const f = fwFake();
    const a = await connect(f);
    expect(a.info.firmware).toBe('1.2.3');
    expect(f.sent.map((s) => s.cmd)).toEqual([0x18, 0x0b]);
  });

  it('joins non-printable firmware bytes with dots', async () => {
    const f = fwFake();
    f.firmware = Uint8Array.of(1, 2, 3);
    expect((await connect(f)).info.firmware).toBe('1.2.3');
  });

  it('rejects a wrong band count and closes', async () => {
    const f = makeFake();
    f.bandCount = 5;
    await expect(connect(f)).rejects.toBeInstanceOf(ProtocolError);
    expect(f.opened).toBe(false);
  });

  it('connects with firmware null on firmware timeout', async () => {
    vi.useFakeTimers();
    const f = fwFake();
    f.silentCmds.add(0x0b);
    const p = connect(f);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await p).info.firmware).toBeNull();
  });

  it('throws for an unknown product without opening', async () => {
    const f = makeFake();
    f.productId = 0x9999;
    await expect(connect(f)).rejects.toBeInstanceOf(UnsupportedDeviceError);
    expect(f.opened).toBe(false);
    expect(f.sent).toEqual([]);
  });

  it('counts non-zero bad CRCs but accepts the reply; zero CRC is not counted', async () => {
    const f = makeFake();
    f.badCrcCmds.add(0x16);
    const a = await connect(f);
    await a.readActiveProfile();
    expect(a.crcMismatches).toBe(0);
    expect(await a.getActiveSlot()).toBe(160);
    expect(a.crcMismatches).toBe(1);
  });

  it('logs outgoing and incoming frames', async () => {
    const f = makeFake();
    const log = vi.fn();
    await connect(f, { log });
    expect(log.mock.calls.map((c) => c[0])).toEqual(['out', 'in']);
  });
});

describe('writeSlot', () => {
  it('sends the documented frame order and saves', async () => {
    const f = makeFake();
    const a = await connect(f);
    f.sent.length = 0;
    const p = profile();
    const back = await a.writeSlot(165, p);
    expect(f.sent.map((s) => `${s.kind}:${s.cmd.toString(16)}`)).toEqual([
      'set:16', 'get:16',
      'set:17',
      ...Array(10).fill('set:15'),
      'set:19',
      ...Array(10).fill('get:15'),
      'get:17',
    ]);
    expect(back.bands).toHaveLength(10);
    expect(f.slot(165).preamp).toBe(-3.5);
    expect(f.slot(165).bands[9]!.gain).toBe(4.5);
    expect(f.saved).toEqual([165]);
  });

  it('treats a padded disabled band as equal', async () => {
    const f = makeFake();
    const a = await connect(f);
    const p = profile();
    p.bands[9] = band(16000, 0, { enabled: false });
    await expect(a.writeSlot(160, p)).resolves.toBeDefined();
  });

  it('rejects with WriteVerifyError carrying both profiles', async () => {
    const f = makeFake();
    f.corruptBandWrites = true;
    const a = await connect(f);
    const p = profile();
    const err = await a.writeSlot(160, p).catch((e) => e);
    expect(err).toBeInstanceOf(WriteVerifyError);
    expect(err.expected).toBe(p);
    expect(err.readBack.bands[0].gain).toBe(p.bands[0]!.gain + 1);
  });

  it.each([
    ['slot 0', 0, () => profile()],
    ['slot 240', 240, () => profile()],
    ['9 bands', 160, () => profile({ bands: profile().bands.slice(0, 9) })],
    ['gain 13', 160, () => { const p = profile(); p.bands[0]!.gain = 13; return p; }],
    ['Q 9', 160, () => { const p = profile(); p.bands[0]!.q = 9; return p; }],
    ['preamp -25', 160, () => profile({ preamp: -25 })],
    ['type', 160, () => { const p = profile(); p.bands[0]!.type = 'LP' as never; return p; }],
  ])('guards %s without sending', async (_n, id, make) => {
    const f = makeFake();
    const a = await connect(f);
    f.sent.length = 0;
    await expect(a.writeSlot(id, make())).rejects.toBeInstanceOf(RangeError);
    expect(f.sent).toEqual([]);
  });

  it('honours default timing', async () => {
    vi.useFakeTimers();
    const f = makeFake();
    const a = await (async () => {
      const p = connectFiio(f.asHid(), { hid: new EventTarget() });
      await vi.advanceTimersByTimeAsync(0);
      return p;
    })();
    f.sent.length = 0;
    const w = a.writeSlot(161, profile());
    await vi.advanceTimersByTimeAsync(10_000);
    await w;
    const bands = f.sent.filter((s) => s.kind === 'set' && s.cmd === 0x15);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i]!.at - bands[i - 1]!.at).toBeGreaterThanOrEqual(100);
    }
    const pre = f.sent.find((s) => s.kind === 'set' && s.cmd === 0x17)!;
    expect(bands[0]!.at - pre.at).toBeGreaterThanOrEqual(DEFAULT_FIIO_TIMING.afterPreampMs);
    const switchSet = f.sent.find((s) => s.kind === 'set' && s.cmd === 0x16)!;
    const switchGet = f.sent.find((s) => s.kind === 'get' && s.cmd === 0x16)!;
    expect(switchGet.at - switchSet.at).toBeGreaterThanOrEqual(DEFAULT_FIIO_TIMING.setGapMs);
  });

  it('still works when the device does reply to sets', async () => {
    const f = makeFake();
    f.replyToSets = true;
    const a = await connect(f);
    await expect(a.writeSlot(162, profile())).resolves.toBeDefined();
    expect(f.active).toBe(162);
  });
});

describe('readSlot and setActiveSlot', () => {
  it('reads another slot and restores the active one', async () => {
    const f = makeFake();
    const p = profile();
    f.slots.set(161, structuredClone(p));
    const a = await connect(f);
    const r = await a.readSlot(161);
    expect(r.preamp).toBe(-3.5);
    expect(r.bands[0]!.gain).toBe(-4.5);
    expect(f.active).toBe(160);
  });

  it('restores the active slot when a read fails', async () => {
    vi.useFakeTimers();
    const f = makeFake();
    const a = await (async () => {
      const c = connectFiio(f.asHid(), { timing: ZERO, hid: new EventTarget() });
      await vi.advanceTimersByTimeAsync(0);
      return c;
    })();
    f.silentCmds.add(0x15);
    const assertion = expect(a.readSlot(161)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(f.active).toBe(160);
  });

  it('sets the EQ-off slot and rejects unknown slots', async () => {
    const f = makeFake();
    const a = await connect(f);
    await a.setActiveSlot(240);
    expect(f.active).toBe(240);
    f.sent.length = 0;
    await expect(a.setActiveSlot(170)).rejects.toBeInstanceOf(RangeError);
    expect(f.sent).toEqual([]);
  });

  it('rejects when the device ignores a slot switch, and writes nothing', async () => {
    const f = makeFake();
    f.ignoreSlotSwitch = true;
    const a = await connect(f);
    await expect(a.setActiveSlot(161)).rejects.toBeInstanceOf(ProtocolError);
    f.sent.length = 0;
    await expect(a.writeSlot(161, profile())).rejects.toBeInstanceOf(ProtocolError);
    expect(f.sent.filter((s) => s.kind === 'set').map((s) => s.cmd)).toEqual([0x16]);
  });
});

describe('onDisconnect', () => {
  const evt = (device: unknown) => Object.assign(new Event('disconnect'), { device });

  it('fires once for this device', async () => {
    const f = makeFake();
    const hid = new EventTarget();
    const a = await connect(f, { hid });
    const cb = vi.fn();
    a.onDisconnect(cb);
    hid.dispatchEvent(evt(f));
    hid.dispatchEvent(evt(f));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(f.opened).toBe(false);
  });

  it('ignores other devices', async () => {
    const f = makeFake();
    const hid = new EventTarget();
    const a = await connect(f, { hid });
    const cb = vi.fn();
    a.onDisconnect(cb);
    hid.dispatchEvent(evt({}));
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not fire on disconnect()', async () => {
    const f = makeFake();
    const hid = new EventTarget();
    const a = await connect(f, { hid });
    const cb = vi.fn();
    a.onDisconnect(cb);
    await a.disconnect();
    hid.dispatchEvent(evt(f));
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('pickFiioInterface', () => {
  const iface = (productId: number, reportIds: number[]) => ({
    vendorId: 0x2972,
    productId,
    collections: [{ outputReports: reportIds.map((reportId) => ({ reportId })) }] as unknown as HIDCollectionInfo[],
  });

  it('picks the interface that has the model command report', () => {
    const mqa = iface(0x0088, []);
    const control = iface(0x0088, [2, 7]);
    expect(pickFiioInterface([mqa, control])).toBe(control);
  });

  it('returns null for unknown models or a missing command report', () => {
    expect(pickFiioInterface([iface(0x0001, [7])])).toBeNull();
    expect(pickFiioInterface([iface(0x0088, [2])])).toBeNull();
  });
});
