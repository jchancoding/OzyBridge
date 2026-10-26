import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EqBand } from '../../core/eq';
import type { HidLike } from '../../transport/webhid';
import marigold from './__fixtures__/walkplay_default_moondrop_marigold.json';
import schemeno15Ddhifi from './__fixtures__/walkplay_schemeno15_ddhifi_dsp_cable.json';
import schemeno15Stargate from './__fixtures__/walkplay_schemeno15_tanchjim_stargate_ii.json';
import schemeno16ProtocolMax from './__fixtures__/walkplay_schemeno16_protocol_max.json';
import schemeno16Tp35 from './__fixtures__/walkplay_schemeno16_tp35_pro.json';
import schemeno16SpacePro from './__fixtures__/walkplay_schemeno16_tanchjim_space_pro.json';
import schemeno18Octave from './__fixtures__/walkplay_schemeno18_nicehck_octave.json';
import { CUSTOM_SLOT_ID, ReadOnlyDeviceError, connectWalkplay } from './adapter';
import { decodePeqBand, REPORT_ID } from './protocol';

interface CaptureExchange {
  send: { reportId: number; data: number[] };
  responses: { reportId: number; data: number[] }[];
  description?: string;
}

interface CaptureFile {
  device: { vendorId: number; productId: number; productName: string };
  exchanges: CaptureExchange[];
}

const CAPTURE_CASES: CaptureFile[] = [
  marigold as CaptureFile,
  schemeno15Ddhifi as CaptureFile,
  schemeno15Stargate as CaptureFile,
  schemeno16ProtocolMax as CaptureFile,
  schemeno16Tp35 as CaptureFile,
  schemeno16SpacePro as CaptureFile,
  schemeno18Octave as CaptureFile,
];

function isReadExchange(e: CaptureExchange): boolean {
  if (e.description?.startsWith('Write')) return false;
  if (e.send.data[0] === 0x01) return false;
  return e.send.data[0] === 0x80;
}

function readExchanges(capture: CaptureFile): CaptureExchange[] {
  return capture.exchanges.filter(isReadExchange);
}

function isPeqBandRead(send: number[]): boolean {
  return (
    send.length === 6 &&
    send[0] === 0x80 &&
    send[1] === 0x09 &&
    send[2] === 0x00 &&
    send[3] === 0x00 &&
    send[5] === 0x00
  );
}

function peqBandExchanges(capture: CaptureFile): CaptureExchange[] {
  const seen = new Set<number>();
  const out: CaptureExchange[] = [];
  for (const e of capture.exchanges) {
    if (!isPeqBandRead(e.send.data)) continue;
    const i = e.send.data[4]!;
    if (seen.has(i)) continue;
    seen.add(i);
    out.push(e);
  }
  return out.sort((a, b) => a.send.data[4]! - b.send.data[4]!);
}

function expectedBands(capture: CaptureFile): EqBand[] {
  return peqBandExchanges(capture).map((e) => decodePeqBand(Uint8Array.from(e.responses[0]!.data)));
}

class FakeWalkplayHid {
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
    const ex = this.readExchanges
      .filter((e) => e.send.data.every((b, i) => frame[i] === b))
      .sort((a, b) => b.send.data.length - a.send.data.length)[0];
    if (!ex) throw new Error(`unexpected send ${[...frame.subarray(0, 8)].join(',')}`);
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

describe('connectWalkplay', () => {
  it.each(CAPTURE_CASES)('$device.productName capture replay', async (capture) => {
    const expected = expectedBands(capture);
    const f = new FakeWalkplayHid(capture);
    const a = await connectWalkplay(f.asHid(), { hid: new EventTarget() });
    expect(a.info.productName).toBe(capture.device.productName);
    expect(await a.getActiveSlot()).toBe(CUSTOM_SLOT_ID);
    const p = await a.readActiveProfile();
    expect(p.preamp).toBe(0);
    expect(p.bands).toHaveLength(expected.length);
    p.bands.forEach((b, i) => expectBandClose(b, expected[i]!));
    const bandReads = peqBandExchanges(capture).length;
    expect(f.sent.length).toBe(2 + bandReads);
  });

  it('readSlot(101) matches readActiveProfile (Marigold)', async () => {
    const f = new FakeWalkplayHid(marigold as CaptureFile);
    const a = await connectWalkplay(f.asHid(), { hid: new EventTarget() });
    const slot = await a.readSlot(101);
    expect(slot.bands[3]!.freq).toBeCloseTo(1100, 0);
  });

  it('rejects writes without sending', async () => {
    const f = new FakeWalkplayHid(marigold as CaptureFile);
    const a = await connectWalkplay(f.asHid(), { hid: new EventTarget() });
    const before = f.sent.length;
    await expect(a.setActiveSlot(101)).rejects.toBeInstanceOf(ReadOnlyDeviceError);
    await expect(a.writeSlot(101, { preamp: 0, bands: [] })).rejects.toBeInstanceOf(ReadOnlyDeviceError);
    expect(f.sent.length).toBe(before);
  });
});
