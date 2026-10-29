import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectDeviceFilters, describeHid, HidTransport, TransportClosedError, TransportTimeoutError, type HidLike } from './webhid';

class FakeHid {
  opened = false;
  productName = 'Fake';
  vendorId = 0x2972;
  productId = 1;
  sent: { id: number; data: Uint8Array; at: number }[] = [];
  handlers = new Set<(e: Event) => void>();
  collections: HIDCollectionInfo[] = [
    {
      outputReports: [
        { reportId: 7, items: [{ reportSize: 8, reportCount: 4 }, { reportSize: 16, reportCount: 2 }] },
      ],
    } as unknown as HIDCollectionInfo,
  ];
  open = vi.fn(async () => { this.opened = true; });
  close = vi.fn(async () => { this.opened = false; });
  sendReport = vi.fn(async (id: number, data: BufferSource) => {
    const b = data as Uint8Array;
    this.sent.push({ id, data: b.slice(), at: Date.now() });
  });
  addEventListener = vi.fn((_t: string, h: EventListenerOrEventListenerObject) => {
    this.handlers.add(h as (e: Event) => void);
  });
  removeEventListener = vi.fn((_t: string, h: EventListenerOrEventListenerObject) => {
    this.handlers.delete(h as (e: Event) => void);
  });
  emit(reportId: number, bytes: number[]) {
    const data = new DataView(new Uint8Array(bytes).buffer);
    for (const h of [...this.handlers]) h({ reportId, data } as unknown as Event);
  }
}

const flush = () => vi.advanceTimersByTimeAsync(0);

async function make(opts: { minGapMs?: number; timeoutMs?: number } = {}) {
  const dev = new FakeHid();
  const t = new HidTransport(dev as unknown as HidLike, { reportId: 7, ...opts });
  await t.open();
  return { dev, t };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('HidTransport', () => {
  it('derives output report length and pads', async () => {
    const { dev, t } = await make();
    const p = t.send(new Uint8Array([1, 2]));
    await flush();
    await p;
    expect(dev.sent[0]?.id).toBe(7);
    expect([...(dev.sent[0]?.data ?? [])]).toEqual([1, 2, 0, 0, 0, 0, 0, 0]);
  });

  it('throws when the frame is too long', async () => {
    const { t } = await make();
    const p = t.send(new Uint8Array(9));
    const assertion = expect(p).rejects.toThrow(/9 bytes/);
    await flush();
    await assertion;
  });

  it('throws on open when the report is missing', async () => {
    const dev = new FakeHid();
    dev.collections = [];
    const t = new HidTransport(dev as unknown as HidLike, { reportId: 7 });
    await expect(t.open()).rejects.toThrow();
  });

  it('request skips non-matching reports and other report ids', async () => {
    const { dev, t } = await make();
    const p = t.request(new Uint8Array([1]), (r) => r[0] === 0xaa);
    await flush();
    dev.emit(7, [0x01]);
    dev.emit(9, [0xaa]);
    dev.emit(7, [0xaa, 5]);
    expect([...(await p)]).toEqual([0xaa, 5]);
  });

  it('subscribe sees every report on the report id until unsubscribed', async () => {
    const { dev, t } = await make();
    const seen: number[] = [];
    const off = t.subscribe((d) => seen.push(d[0]!));
    dev.emit(7, [1]);
    dev.emit(9, [2]);
    off();
    dev.emit(7, [3]);
    expect(seen).toEqual([1]);
  });

  it('request times out', async () => {
    const { t } = await make({ timeoutMs: 500 });
    const p = t.request(new Uint8Array([1]), () => true);
    const assertion = expect(p).rejects.toBeInstanceOf(TransportTimeoutError);
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });

  it('runs operations in FIFO order, one at a time', async () => {
    const { dev, t } = await make();
    const order: number[] = [];
    const a = t.request(new Uint8Array([1]), (r) => r[0] === 1).then(() => order.push(1));
    const b = t.send(new Uint8Array([2])).then(() => order.push(2));
    const c = t.request(new Uint8Array([3]), (r) => r[0] === 3).then(() => order.push(3));
    await flush();
    expect(dev.sent.map((s) => s.data[0])).toEqual([1]);
    dev.emit(7, [1]);
    await flush();
    expect(dev.sent.map((s) => s.data[0])).toEqual([1, 2, 3]);
    dev.emit(7, [3]);
    await Promise.all([a, b, c]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('respects minGapMs between operations', async () => {
    const { dev, t } = await make({ minGapMs: 50 });
    const a = t.send(new Uint8Array([1]));
    const b = t.send(new Uint8Array([2]));
    await flush();
    expect(dev.sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(49);
    expect(dev.sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await Promise.all([a, b]);
    expect(dev.sent).toHaveLength(2);
    expect((dev.sent[1]?.at ?? 0) - (dev.sent[0]?.at ?? 0)).toBeGreaterThanOrEqual(50);
  });

  it('close rejects pending and queued operations', async () => {
    const { dev, t } = await make();
    const a = t.request(new Uint8Array([1]), () => true);
    const b = t.send(new Uint8Array([2]));
    const ea = expect(a).rejects.toBeInstanceOf(TransportClosedError);
    const eb = expect(b).rejects.toBeInstanceOf(TransportClosedError);
    await flush();
    await t.close();
    await ea;
    await eb;
    expect(dev.handlers.size).toBe(0);
    expect(dev.close).toHaveBeenCalled();
    await expect(t.send(new Uint8Array([3]))).rejects.toBeInstanceOf(TransportClosedError);
  });

  it('tap sees outbound and inbound reports', async () => {
    const { dev, t } = await make();
    const seen: string[] = [];
    t.tap((dir, data) => seen.push(`${dir}:${data[0]}`));
    const p = t.send(new Uint8Array([0x11]));
    await flush();
    await p;
    dev.emit(7, [0x22]);
    expect(seen).toEqual(['out:17', 'in:34']);
  });
});

describe('connectDeviceFilters', () => {
  it('offers unlisted probe vendors without a usage-page filter', () => {
    const vendors = connectDeviceFilters().map((f) => f.vendorId);
    expect(vendors).toEqual(expect.arrayContaining([0x2fc6, 0x2d87]));
    for (const id of [0x2fc6, 0x2d87]) {
      expect(connectDeviceFilters().find((f) => f.vendorId === id)?.usagePage).toBeUndefined();
    }
  });
});

describe('describeHid', () => {
  it('returns collection report ids without opening the device', () => {
    const dev = new FakeHid();
    dev.vendorId = 0x31b2;
    dev.productId = 0x1234;
    dev.productName = 'Test DSP';
    dev.collections = [
      {
        usagePage: 0xff00,
        usage: 0x01,
        inputReports: [{ reportId: 1 }],
        outputReports: [{ reportId: 2 }],
        featureReports: [{ reportId: 3 }],
      } as unknown as HIDCollectionInfo,
    ];
    const d = describeHid(dev as unknown as HIDDevice);
    expect(d.productName).toBe('Test DSP');
    expect(d.vendorId).toBe(0x31b2);
    expect(d.collections[0]).toEqual({
      usagePage: 0xff00,
      usage: 0x01,
      input: [1],
      output: [2],
      feature: [3],
    });
    expect(dev.open).not.toHaveBeenCalled();
    expect(dev.sendReport).not.toHaveBeenCalled();
  });
});
