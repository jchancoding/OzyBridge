import { describe, expect, it } from 'vitest';
import type { EqProfile } from './eq';
import { decodeShareFragment, encodeShareFragment } from './shareLink';

const profile: EqProfile = {
  preamp: -3.5,
  bands: Array.from({ length: 10 }, (_, i) => ({
    type: i === 0 ? 'LSC' : i === 9 ? 'HSC' : 'PK',
    freq: 31.5 * 2 ** i, gain: i - 4.5, q: 0.707, enabled: i !== 3,
  })),
};
const enc = (t: string) => btoa(String.fromCharCode(...new TextEncoder().encode(t))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64 = (o: unknown) => 'eq=' + enc(JSON.stringify(o));
const bad = (h: string) => expect(decodeShareFragment(h).ok).toBe(false);

describe('shareLink', () => {
  it('round trips with a non-ASCII name, with or without #', () => {
    const f = encodeShareFragment({ name: 'Müsik ♪ 音楽', profile });
    for (const h of [f, `#${f}`]) {
      expect(decodeShareFragment(h)).toEqual({ ok: true, name: 'Müsik ♪ 音楽', profile });
    }
  });
  it('stays URL-safe and short', () => {
    const f = encodeShareFragment({ name: 'Müsik ♪ 音楽', profile });
    expect(f).not.toMatch(/[?&]/);
    expect(f.slice(3)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(f.length).toBeLessThan(2000);
  });
  it('rejects bad input', () => {
    bad('#eq=***');
    bad('#eq=abcde');
    bad('#x=1');
    bad('eq=' + enc('{nope'));
    bad(b64({ v: 2, n: '', p: 0, b: [] }));
    bad(b64({ v: 1, n: '', p: 0, b: [['XX', 100, 0, 1, 1]] }));
    bad(b64({ v: 1, n: '', p: 0, b: [['PK', null, 0, 1, 1]] }));
    bad(b64({ v: 1, n: '', p: 'x', b: [] }));
    bad(b64({ v: 1, n: '', p: 0, b: Array(65).fill(['PK', 100, 0, 1, 1]) }));
    expect(decodeShareFragment(b64({ v: 1, n: '', p: 0, b: Array(64).fill(['PK', 100, 0, 1, 1]) })).ok).toBe(true);
  });
});
