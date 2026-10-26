import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HidLike } from '../../transport/webhid';
import capture from './__fixtures__/walkplay_default_moondrop_marigold.json';
import { CUSTOM_SLOT_ID, ReadOnlyDeviceError, connectWalkplay } from './adapter';
import { REPORT_ID } from './protocol';

interface CaptureExchange {
  send: { reportId: number; data: number[] };
  responses: { reportId: number; data: number[] }[];
  description?: string;
}

const READ_EXCHANGES = (capture as { exchanges: CaptureExchange[] }).exchanges.filter(
  (e) => e.description !== undefined && !e.description.startsWith('Write'),
);

class FakeWalkplayHid {
  opened = false;
  vendorId = 0x35d8;
  productId = 0x011c;
  productName = 'MOONDROP Marigold';
  collections = [
    { outputReports: [{ reportId: REPORT_ID, items: [{ reportSize: 8, reportCount: 64 }] }] },
  ] as unknown as HIDCollectionInfo[];

  sent: Uint8Array[] = [];
  private handlers = new Set<(e: Event) => void>();

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
    const ex = READ_EXCHANGES
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

const EXPECTED_BANDS = [
  { type: 'PK', freq: 25, gain: 0, q: 0.5, enabled: true },
  { type: 'PK', freq: 150, gain: 0, q: 3, enabled: true },
  { type: 'PK', freq: 778, gain: 0, q: 7.2, enabled: true },
  { type: 'PK', freq: 1100, gain: 0, q: 1.6, enabled: true },
  { type: 'PK', freq: 2100, gain: 0, q: 0.8, enabled: true },
  { type: 'PK', freq: 8600, gain: 0, q: 0.4, enabled: true },
  { type: 'PK', freq: 10000, gain: 0, q: 1.2, enabled: true },
  { type: 'PK', freq: 10630, gain: 0, q: 7, enabled: true },
] as const;

const tol = { gain: 0.01, freq: 0.5, q: 0.01 };

afterEach(() => vi.useRealTimers());

describe('connectWalkplay', () => {
  it('replays the Marigold read capture', async () => {
    const f = new FakeWalkplayHid();
    const a = await connectWalkplay(f.asHid(), { hid: new EventTarget() });
    expect(a.info.firmware).toBe('0.1');
    expect(await a.getActiveSlot()).toBe(CUSTOM_SLOT_ID);
    const p = await a.readActiveProfile();
    expect(p.preamp).toBe(0);
    p.bands.forEach((b, i) => {
      const e = EXPECTED_BANDS[i]!;
      expect(b.type).toBe(e.type);
      expect(b.enabled).toBe(e.enabled);
      expect(Math.abs(b.freq - e.freq)).toBeLessThanOrEqual(tol.freq);
      expect(Math.abs(b.gain - e.gain)).toBeLessThanOrEqual(tol.gain);
      expect(Math.abs(b.q - e.q)).toBeLessThanOrEqual(tol.q);
    });
    expect(f.sent.length).toBe(10);
  });

  it('readSlot(101) matches readActiveProfile', async () => {
    const f = new FakeWalkplayHid();
    const a = await connectWalkplay(f.asHid(), { hid: new EventTarget() });
    const slot = await a.readSlot(101);
    expect(slot.bands[3]!.freq).toBeCloseTo(1100, 0);
  });

  it('rejects writes without sending', async () => {
    const f = new FakeWalkplayHid();
    const a = await connectWalkplay(f.asHid(), { hid: new EventTarget() });
    const before = f.sent.length;
    await expect(a.setActiveSlot(101)).rejects.toBeInstanceOf(ReadOnlyDeviceError);
    await expect(a.writeSlot(101, { preamp: 0, bands: [] })).rejects.toBeInstanceOf(ReadOnlyDeviceError);
    expect(f.sent.length).toBe(before);
  });
});
