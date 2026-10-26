import type { EqBand, EqProfile, FilterType } from './eq';

export const MAX_SHARED_BANDS = 64;
const TYPES: FilterType[] = ['PK', 'LSC', 'HSC'];

export type ShareDecode =
  | { ok: true; name: string; profile: EqProfile }
  | { ok: false; errors: string[] };

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new Error('bad base64');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function encodeShareFragment({ name, profile }: { name: string; profile: EqProfile }): string {
  const json = JSON.stringify({
    v: 1,
    n: name,
    p: profile.preamp,
    b: profile.bands.map((b) => [b.type, b.freq, b.gain, b.q, b.enabled ? 1 : 0]),
  });
  return `eq=${toBase64Url(new TextEncoder().encode(json))}`;
}

export function decodeShareFragment(hash: string): ShareDecode {
  const fail = (m: string): ShareDecode => ({ ok: false, errors: [m] });
  const m = /^#?eq=(.*)$/.exec(hash);
  if (!m) return fail('This is not a shared EQ link.');
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fromBase64Url(m[1] ?? '')));
  } catch {
    return fail('The shared EQ link is damaged.');
  }
  if (typeof data !== 'object' || data === null) return fail('The shared EQ link is damaged.');
  const d = data as Record<string, unknown>;
  if (d.v !== 1) return fail('This shared EQ link comes from an unsupported version.');
  if (typeof d.n !== 'string' || typeof d.p !== 'number' || !Number.isFinite(d.p) || !Array.isArray(d.b)) {
    return fail('The shared EQ link is damaged.');
  }
  if (d.b.length > MAX_SHARED_BANDS) return fail(`The shared EQ has more than ${MAX_SHARED_BANDS} bands.`);
  const bands: EqBand[] = [];
  for (const [i, row] of d.b.entries()) {
    if (!Array.isArray(row) || row.length !== 5) return fail(`Band ${i + 1} in the shared EQ is damaged.`);
    const [type, freq, gain, q, en] = row as unknown[];
    if (!TYPES.includes(type as FilterType)) return fail(`Band ${i + 1} has an unknown filter type.`);
    if (![freq, gain, q].every((n) => typeof n === 'number' && Number.isFinite(n))) {
      return fail(`Band ${i + 1} has an invalid number.`);
    }
    if (en !== 0 && en !== 1) return fail(`Band ${i + 1} is damaged.`);
    bands.push({ type: type as FilterType, freq: freq as number, gain: gain as number, q: q as number, enabled: en === 1 });
  }
  return { ok: true, name: d.n, profile: { preamp: d.p, bands } };
}
