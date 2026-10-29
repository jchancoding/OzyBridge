import { describe, expect, it } from 'vitest';
import type { HidLike } from '../transport/webhid';
import { canFamilyProbe, runFamilyProbe } from './familyProbe';
import marigold from './walkplay/__fixtures__/walkplay_default_moondrop_marigold.json';

interface Exchange { send: { data: number[] }; responses: { data: number[] }[] }

class ScriptedHid {
  opened = false;
  vendorId = 0x2d87;
  productId = 0x003b;
  productName = 'Cayin RU3 (U2)';
  collections = [
    { usagePage: 0x0c, outputReports: [{ reportId: 0x4b, items: [{ reportSize: 8, reportCount: 64 }] }] },
  ] as unknown as HIDCollectionInfo[];
  sent: Uint8Array[] = [];
  private handlers = new Set<(e: Event) => void>();
  constructor(private readonly respond: (frame: Uint8Array) => number[] | null) {}
  open = async () => { this.opened = true; };
  close = async () => { this.opened = false; };
  addEventListener = (_t: string, h: EventListenerOrEventListenerObject) => { this.handlers.add(h as (e: Event) => void); };
  removeEventListener = (_t: string, h: EventListenerOrEventListenerObject) => { this.handlers.delete(h as (e: Event) => void); };
  sendReport = async (_id: number, data: BufferSource) => {
    const frame = new Uint8Array(data as ArrayBuffer).slice();
    this.sent.push(frame);
    const reply = this.respond(frame);
    if (!reply) return;
    const buf = Uint8Array.from(reply);
    queueMicrotask(() => {
      for (const h of [...this.handlers]) h({ reportId: 0x4b, data: new DataView(buf.buffer) } as unknown as Event);
    });
  };
}

const isReadFrame = (f: Uint8Array) => f[0] === 0x80 || f[4] === 0x52;

describe('runFamilyProbe', () => {
  it('only offers the probe on devices with output report 0x4B', () => {
    expect(canFamilyProbe(new ScriptedHid(() => null))).toBe(true);
    expect(canFamilyProbe({ vendorId: 0x2d87, collections: [{ outputReports: [{ reportId: 0 }] }] } as unknown as HIDDevice)).toBe(false);
    expect(
      canFamilyProbe({ vendorId: 0x046d, collections: [{ outputReports: [{ reportId: 0x4b }] }] } as unknown as HIDDevice),
    ).toBe(false);
  });

  it('decodes a WalkPlay band and records silence from KTMicro reads', async () => {
    const exchanges = (marigold as { exchanges: Exchange[] }).exchanges;
    const dev = new ScriptedHid((frame) => {
      const ex = exchanges
        .filter((e) => e.send.data[0] === 0x80 && e.send.data.every((b, i) => frame[i] === b))
        .sort((a, b) => b.send.data.length - a.send.data.length)[0];
      return ex?.responses[0]?.data ?? null;
    });
    const r = await runFamilyProbe(dev as unknown as HidLike, 30);
    const bandLines = r.lines.filter((l) => l.startsWith('walkplay band'));
    expect(bandLines[0]).toMatch(/^walkplay band 1: .*Hz/);
    expect(bandLines.length).toBeGreaterThan(1);
    expect(bandLines.length).toBeLessThanOrEqual(10);
    expect(r.lines.filter((l) => l.startsWith('ktmicro')).every((l) => l.endsWith('no reply'))).toBe(true);
    expect(dev.sent.every(isReadFrame)).toBe(true);
    expect(r.rawHex.some((l) => l.startsWith('in '))).toBe(true);
    expect(dev.opened).toBe(false);
  });

  it('reports no reply from both families on a silent device', async () => {
    const dev = new ScriptedHid(() => null);
    const r = await runFamilyProbe(dev as unknown as HidLike, 20);
    expect(r.lines).toHaveLength(5);
    expect(dev.sent).toHaveLength(5);
    expect(r.lines.every((l) => l.endsWith('no reply'))).toBe(true);
    expect(dev.sent.every(isReadFrame)).toBe(true);
  });
});
