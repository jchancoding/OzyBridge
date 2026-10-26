import { describe, expect, it } from 'vitest';
import { deviceReportUrl } from './reportLink';

describe('deviceReportUrl', () => {
  const parse = (u: string) => new URL(u);

  it('builds title and body', () => {
    const u = parse(deviceReportUrl({ name: 'FiiO KA15', productId: 0x104, firmware: '1.2' }));
    expect(u.origin + u.pathname).toBe('https://github.com/jchancoding/OzyBridge/issues/new');
    expect(u.searchParams.get('title')).toBe('[device report] FiiO KA15');
    const body = u.searchParams.get('body')!;
    expect(body).toContain('Model: FiiO KA15');
    expect(body).toContain('Product ID: 0x0104');
    expect(body).toContain('Firmware: 1.2');
    expect(body.match(/- \[ \] /g)).toHaveLength(4);
  });

  it('falls back to unknown firmware', () => {
    const body = parse(deviceReportUrl({ name: 'X', productId: 0x4016, firmware: null })).searchParams.get('body')!;
    expect(body).toContain('Firmware: unknown');
    expect(body).toContain('0x4016');
  });

  it('url-encodes without raw spaces, newlines or hashes', () => {
    const raw = deviceReportUrl({ name: 'A&B #1', productId: 1, firmware: null });
    expect(raw).not.toMatch(/[ \n#]/);
    expect(parse(raw).searchParams.get('title')).toBe('[device report] A&B #1');
  });
});
