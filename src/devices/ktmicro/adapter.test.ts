import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EqBand } from '../../core/eq';
import type { HidLike } from '../../transport/webhid';
import allegroMini from './__fixtures__/ktmicro_kiwi_ears_allegro_mini.json';
import kt02 from './__fixtures__/ktmicro_kt02h20_hifi_audio.json';
import { ReadOnlyDeviceError } from '../walkplay/adapter';
import { CUSTOM_SLOT_ID, connectKtmicro } from './adapter';
import { OP_READ, REG_DIG_GAIN, assertAllowedOutbound, bandRegisterPair, decodeBand, REPORT_ID } from './protocol';

interface CaptureExchange {
  send: { reportId: number; data: number[] };
  responses: { reportId: number; data: number[] }[];
}

interface CaptureFile {
  device: { vendorId: number; productId: number; productName: string };
  exchanges: CaptureExchange[];
}

const CAPTURE_CASES: CaptureFile[] = [allegroMini as CaptureFile, kt02 as CaptureFile];

function isAllowedRead(e: CaptureExchange): boolean {
  const d = e.send.data;
  return d[4] === OP_READ && d[1] === 0 && d[2] === 0 && d[3] === 0 && d[5] === 0;
}

function readExchanges(capture: CaptureFile): CaptureExchange[] {
  return capture.exchanges.filter(isAllowedRead);
}

function expectedBands(capture: CaptureFile): EqBand[] {
  const bands = [];
  for (let i = 0; i < 5; i++) {
    const { gainFreq, q } = bandRegisterPair({ baseRegisterOffset: 0x26 }, i);
    const gf = capture.exchanges.find((e) => e.send.data[0] === gainFreq && e.send.data[4] === OP_READ);
    const qt = capture.exchanges.find((e) => e.send.data[0] === q && e.send.data[4] === OP_READ);
    if (!gf || !qt) break;
    bands.push(
      decodeBand(
        Uint8Array.from(gf.responses[0]!.data),
        Uint8Array.from(qt.responses[0]!.data),
        false,
      ),
    );
  }
  return bands;
}

class FakeKtmicroHid {
  opened = false;
  vendorId: number;
  productId: number;
  productName: string;
  private readonly readExchanges: CaptureExchange[];

  collections = [
    { outputReports: [{ reportId: REPORT_ID, items: [{ reportSize: 8, reportCount: 64 }] }] },
  ] as unknown as HIDCollectionInfo[];

  sent: Uint8Array[] = [];
  private handlers = new Set<(e: Event) => void>();

  constructor(capture: CaptureFile) {
    this.vendorId = capture.device.vendorId;
    this.productId = capture.device.productId;
    this.productName = capture.device.productName;
    this.readExchanges = readExchanges(capture);
  }

  open = async () => {
    this.opened = true;
  };
  close = async () => {
    this.opened = false;
  };
  addEventListener = (_t: string, h: EventListenerOrEventListenerObject) => {
    this.handlers.add(h as (e: Event) => void);
  };
  removeEventListener = (_t: string, h: EventListenerOrEventListenerObject) => {
    this.handlers.delete(h as (e: Event) => void);
  };

  sendReport = async (_id: number, data: BufferSource) => {
    const frame = new Uint8Array(data as ArrayBuffer);
    const ex = this.readExchanges.find((e) => e.send.data.every((b, i) => frame[i] === b));
    if (!ex) throw new Error(`unexpected send ${[...frame.subarray(0, 10)].join(',')}`);
    this.sent.push(frame.subarray(0, ex.send.data.length));
    const reply = Uint8Array.from(ex.responses[0]!.data);
    queueMicrotask(() => {
      for (const h of [...this.handlers]) {
        h({ reportId: REPORT_ID, data: new DataView(reply.buffer) } as unknown as Event);
      }
    });
  };

  asHid(): HidLike {
    return this as unknown as HidLike;
  }
}

const tol = { gain: 0.01, freq: 0.5, q: 0.01 };

function expectBandClose(actual: EqBand, expected: EqBand): void {
  expect(actual.type).toBe(expected.type);
  expect(actual.enabled).toBe(expected.enabled);
  expect(Math.abs(actual.freq - expected.freq)).toBeLessThanOrEqual(tol.freq);
  expect(Math.abs(actual.gain - expected.gain)).toBeLessThanOrEqual(tol.gain);
  expect(Math.abs(actual.q - expected.q)).toBeLessThanOrEqual(tol.q);
}

afterEach(() => vi.useRealTimers());

describe('connectKtmicro', () => {
  it.each(CAPTURE_CASES)('$device.productName capture replay', async (capture) => {
    const expected = expectedBands(capture);
    const f = new FakeKtmicroHid(capture);
    const a = await connectKtmicro(f.asHid(), { hid: new EventTarget() });
    expect(a.info.productName).toBe(capture.device.productName);
    expect(await a.getActiveSlot()).toBe(CUSTOM_SLOT_ID);
    const p = await a.readActiveProfile();
    expect(p.preamp).toBe(0);
    expect(p.bands).toHaveLength(expected.length);
    p.bands.forEach((b, i) => expectBandClose(b, expected[i]!));
    const bandReads = expected.length * 2;
    const digGain = capture.exchanges.some((e) => e.send.data[0] === REG_DIG_GAIN && e.send.data[4] === OP_READ);
    expect(f.sent.length).toBe(bandReads + (digGain ? 1 : 0));
  });

  it('rejects writes without sending', async () => {
    const f = new FakeKtmicroHid(allegroMini as CaptureFile);
    const a = await connectKtmicro(f.asHid(), { hid: new EventTarget() });
    const before = f.sent.length;
    await expect(a.setActiveSlot(101)).rejects.toBeInstanceOf(ReadOnlyDeviceError);
    await expect(a.writeSlot(101, { preamp: 0, bands: [] })).rejects.toBeInstanceOf(ReadOnlyDeviceError);
    expect(f.sent.length).toBe(before);
  });

  it('refuses forbidden frames before transport', () => {
    expect(() =>
      assertAllowedOutbound(Uint8Array.of(0x26, 0, 0, 0, 0x57, 0, 0, 0, 0, 0)),
    ).toThrow();
  });
});