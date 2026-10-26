import type { EqBand, FilterType } from '../../core/eq';

export function crc8Maxim(bytes: Uint8Array): number {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0x8c : crc >>> 1;
  }
  return crc;
}

export const CMD = {
  FIRMWARE_VERSION: 0x0b,
  PEQ_PARAMS: 0x15,
  PEQ_PRE: 0x16,
  GLOBAL_GAIN: 0x17,
  PEQ_COUNT: 0x18,
  PEQ_SAVE: 0x19,
} as const;

export const ALLOWED_GET: ReadonlySet<number> = new Set([0x0b, 0x15, 0x16, 0x17, 0x18]);
export const ALLOWED_SET: ReadonlySet<number> = new Set([0x15, 0x16, 0x17, 0x19]);

export class ForbiddenCommandError extends Error {
  constructor(kind: string, cmd: number) {
    super(`Forbidden ${kind} command 0x${cmd.toString(16).padStart(2, '0')}`);
    this.name = 'ForbiddenCommandError';
  }
}

export function buildFrame(
  kind: 'get' | 'set',
  cmd: number,
  payload: Uint8Array,
  seq: number,
): Uint8Array {
  const allowed = kind === 'get' ? ALLOWED_GET : ALLOWED_SET;
  if (!allowed.has(cmd)) throw new ForbiddenCommandError(kind, cmd);
  if (!Number.isInteger(seq) || seq < 0 || seq > 0xffff) {
    throw new RangeError(`seq out of range: ${seq}`);
  }
  for (const b of payload) {
    if (!Number.isInteger(b) || b < 0 || b > 255) throw new RangeError(`payload byte out of range: ${b}`);
  }
  const n = payload.length;
  if (n > 255) throw new RangeError('payload too long');
  const frame = new Uint8Array(8 + n);
  frame[0] = kind === 'set' ? 0xaa : 0xbb;
  frame[1] = kind === 'set' ? 0x0a : 0x0b;
  frame[2] = seq >> 8;
  frame[3] = seq & 0xff;
  frame[4] = cmd;
  frame[5] = n;
  frame.set(payload, 6);
  frame[6 + n] = crc8Maxim(frame.subarray(0, 6 + n));
  frame[7 + n] = 0xee;
  return frame;
}

export function createSequence(start = 0): () => number {
  let next = start & 0xffff;
  return () => {
    const cur = next;
    next = (next + 1) & 0xffff;
    return cur;
  };
}

function checkInt(name: string, v: number, min: number, max: number): number {
  if (!Number.isFinite(v) || v < min || v > max) throw new RangeError(`${name} out of range: ${v}`);
  return v;
}

export function encodeGain(db: number): Uint8Array {
  const v = checkInt('gain', Math.round(db * 10), -32768, 32767);
  const u = v & 0xffff;
  return Uint8Array.of(u >> 8, u & 0xff);
}

export function decodeGain(hi: number, lo: number): number {
  const u = ((hi & 0xff) << 8) | (lo & 0xff);
  return (u >= 0x8000 ? u - 0x10000 : u) / 10;
}

export function encodeFreq(hz: number): Uint8Array {
  const v = checkInt('freq', Math.round(hz), 0, 0xffff);
  return Uint8Array.of(v >> 8, v & 0xff);
}

export function decodeFreq(hi: number, lo: number): number {
  return ((hi & 0xff) << 8) | (lo & 0xff);
}

export function encodeQ(q: number): Uint8Array {
  const v = checkInt('q', Math.round(q * 100), 0, 0xffff);
  return Uint8Array.of(v >> 8, v & 0xff);
}

export function decodeQ(hi: number, lo: number): number {
  return (((hi & 0xff) << 8) | (lo & 0xff)) / 100;
}

const TYPE_TO_CODE: Record<FilterType, number> = { PK: 0, LSC: 1, HSC: 2 };
const CODE_TO_TYPE: readonly FilterType[] = ['PK', 'LSC', 'HSC'];

export function encodeFilterType(type: FilterType): number {
  const code = TYPE_TO_CODE[type];
  if (code === undefined) throw new RangeError(`unknown filter type: ${String(type)}`);
  return code;
}

export function decodeFilterType(code: number): FilterType {
  const t = CODE_TO_TYPE[code];
  if (t === undefined) throw new RangeError(`unknown filter type code: ${code}`);
  return t;
}

export function encodeBandPayload(index: number, band: EqBand): Uint8Array {
  checkInt('index', index, 0, 255);
  const out = new Uint8Array(8);
  out[0] = index;
  out.set(encodeGain(band.enabled ? band.gain : 0), 1);
  out.set(encodeFreq(band.freq), 3);
  out.set(encodeQ(band.q), 5);
  out[7] = encodeFilterType(band.type);
  return out;
}

export function decodeBandPayload(p: Uint8Array): { index: number; band: EqBand } {
  if (p.length !== 8) throw new RangeError(`band payload must be 8 bytes, got ${p.length}`);
  return {
    index: p[0]!,
    band: {
      type: decodeFilterType(p[7]!),
      freq: decodeFreq(p[3]!, p[4]!),
      gain: decodeGain(p[1]!, p[2]!),
      q: decodeQ(p[5]!, p[6]!),
      enabled: true,
    },
  };
}

const NONE = new Uint8Array(0);

export const getFirmware = (seq: number) => buildFrame('get', CMD.FIRMWARE_VERSION, NONE, seq);
export const getBandCount = (seq: number) => buildFrame('get', CMD.PEQ_COUNT, NONE, seq);
export const getActivePreset = (seq: number) => buildFrame('get', CMD.PEQ_PRE, NONE, seq);
export const getPreamp = (seq: number) => buildFrame('get', CMD.GLOBAL_GAIN, NONE, seq);
export const getBand = (index: number, seq: number) =>
  buildFrame('get', CMD.PEQ_PARAMS, Uint8Array.of(checkInt('index', index, 0, 255)), seq);
export const setBand = (index: number, band: EqBand, seq: number) =>
  buildFrame('set', CMD.PEQ_PARAMS, encodeBandPayload(index, band), seq);
export const setActivePreset = (id: number, seq: number) =>
  buildFrame('set', CMD.PEQ_PRE, Uint8Array.of(checkInt('preset', id, 0, 255)), seq);
export const setPreamp = (db: number, seq: number) =>
  buildFrame('set', CMD.GLOBAL_GAIN, encodeGain(db), seq);
export const savePreset = (id: number, seq: number) =>
  buildFrame('set', CMD.PEQ_SAVE, Uint8Array.of(checkInt('preset', id, 0, 255)), seq);

export function parseReply(
  bytes: Uint8Array,
): { cmd: number; payload: Uint8Array; seq: number; crcOk: boolean } | null {
  if (bytes.length < 8 || bytes[0] !== 0xbb || bytes[1] !== 0x0b) return null;
  const n = bytes[5]!;
  if (bytes.length < 8 + n) return null;
  if (bytes[7 + n] !== 0xee) return null;
  return {
    cmd: bytes[4]!,
    payload: bytes.slice(6, 6 + n),
    seq: (bytes[2]! << 8) | bytes[3]!,
    crcOk: crc8Maxim(bytes.subarray(0, 6 + n)) === bytes[6 + n],
  };
}
