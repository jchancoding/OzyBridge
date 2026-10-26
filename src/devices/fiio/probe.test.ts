import { describe, expect, it } from 'vitest';
import { FakeFiioHid } from './fakeFiioHid';
import { probeFiio } from './probe';

describe('probeFiio', () => {
  it('reports product id, band count and bands', async () => {
    const f = new FakeFiioHid();
    const text = (await probeFiio(f.asHid(), { timeoutMs: 50 })).join('\n');
    expect(text).toContain('productId: 0x0088');
    expect(text).toContain('band count: 10');
    expect(text).toContain('firmware: 1.2.3');
    expect(text).toContain('band 9: PK 16000 Hz 0 dB Q 1');
    expect(f.opened).toBe(false);
  });

  it('sends only GET frames', async () => {
    const f = new FakeFiioHid();
    await probeFiio(f.asHid(), { timeoutMs: 50 });
    expect(f.sent.length).toBeGreaterThan(0);
    expect(f.sent.every((s) => s.kind === 'get')).toBe(true);
    expect(f.sent.map((s) => s.cmd).every((c) => [0x0b, 0x15, 0x16, 0x17, 0x18].includes(c))).toBe(true);
  });

  it('sends nothing without output report 7', async () => {
    const f = new FakeFiioHid();
    f.collections = [{ usagePage: 1, usage: 2, outputReports: [{ reportId: 3 }] }] as unknown as HIDCollectionInfo[];
    const lines = await probeFiio(f.asHid(), { timeoutMs: 50 });
    expect(lines.join('\n')).toContain('no collection has output report 7');
    expect(f.sent).toEqual([]);
  });

  it('logs a timeout and keeps going', async () => {
    const f = new FakeFiioHid();
    f.silentCmds.add(0x0b);
    const text = (await probeFiio(f.asHid(), { timeoutMs: 20 })).join('\n');
    expect(text).toContain('firmware (0x0B): FAILED TransportTimeoutError');
    expect(text).toContain('band 9: PK');
  });
});
