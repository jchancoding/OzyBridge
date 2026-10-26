import { describe, expect, it } from 'vitest';
import {
  CMD,
  ForbiddenCommandError,
  buildFrame,
  createSequence,
  crc8Maxim,
  decodeBandPayload,
  decodeGain,
  encodeBandPayload,
  encodeFreq,
  encodeGain,
  encodeQ,
  getActivePreset,
  getBand,
  getBandCount,
  getFirmware,
  getPreamp,
  parseReply,
  savePreset,
  setActivePreset,
  setBand,
  setPreamp,
} from './protocol';

const hex = (s: string) => Uint8Array.from(s.split(' ').map((h) => parseInt(h, 16)));
const lsc = { type: 'LSC', freq: 22, gain: 6.6, q: 0.73, enabled: true } as const;

describe('doc vectors', () => {
  it.each([
    ['get preset', getActivePreset(0), 'BB 0B 00 00 16 00 C9 EE'],
    ['get count', getBandCount(0), 'BB 0B 00 00 18 00 15 EE'],
    ['get band 0', getBand(0, 0), 'BB 0B 00 00 15 01 00 76 EE'],
    ['get preamp', getPreamp(0), 'BB 0B 00 00 17 00 0D EE'],
    ['get firmware', getFirmware(0), 'BB 0B 00 00 0B 00 AC EE'],
    ['set band 0', setBand(0, lsc, 0), 'AA 0A 00 00 15 08 00 00 42 00 16 00 49 01 80 EE'],
    ['set preamp', setPreamp(-6.9, 0), 'AA 0A 00 00 17 02 FF BB 7F EE'],
    ['switch USER1', setActivePreset(160, 0), 'AA 0A 00 00 16 01 A0 CC EE'],
    ['save USER1', savePreset(160, 0), 'AA 0A 00 00 19 01 A0 93 EE'],
  ])('%s', (_n, got, doc) => {
    expect(got).toEqual(hex(doc));
  });
});

describe('parseReply', () => {
  it('round-trips a get frame turned into a reply', () => {
    const r = parseReply(buildFrame('get', CMD.GLOBAL_GAIN, encodeGain(-6.9), 0x1234));
    expect(r?.cmd).toBe(0x17);
    expect(r?.seq).toBe(0x1234);
    expect(r?.crcOk).toBe(true);
    expect(r && decodeGain(r.payload[0]!, r.payload[1]!)).toBe(-6.9);
  });
  it('allows trailing zero padding', () => {
    const f = getBand(3, 1);
    const padded = new Uint8Array(32);
    padded.set(f);
    expect(parseReply(padded)?.payload).toEqual(Uint8Array.of(3));
  });
  it('flags a bad CRC without rejecting', () => {
    const f = getPreamp(0);
    f[f.length - 2] = f[f.length - 2]! ^ 0xff;
    expect(parseReply(f)?.crcOk).toBe(false);
  });
  it('returns null for malformed input', () => {
    const f = getBand(0, 0);
    expect(parseReply(Uint8Array.of(...f.slice(0, 7), 0))).toBeNull();
    const bad = f.slice();
    bad[0] = 0xaa;
    expect(parseReply(bad)).toBeNull();
    const noEnd = f.slice();
    noEnd[noEnd.length - 1] = 0;
    expect(parseReply(noEnd)).toBeNull();
    const over = f.slice();
    over[5] = 40;
    expect(parseReply(over)).toBeNull();
  });
});

describe('safety and ranges', () => {
  it('throws on forbidden commands', () => {
    for (const c of [0x21, 0x1b, 0x1c, 0x30]) {
      expect(() => buildFrame('set', c, new Uint8Array(0), 0)).toThrow(ForbiddenCommandError);
      expect(() => buildFrame('get', c, new Uint8Array(0), 0)).toThrow(ForbiddenCommandError);
    }
    expect(() => buildFrame('get', 0x19, new Uint8Array(0), 0)).toThrow(ForbiddenCommandError);
    expect(() => buildFrame('set', 0x18, new Uint8Array(0), 0)).toThrow(ForbiddenCommandError);
  });
  it('throws RangeError for bad values', () => {
    expect(() => encodeGain(4000)).toThrow(RangeError);
    expect(() => encodeGain(-4000)).toThrow(RangeError);
    expect(() => encodeQ(700)).toThrow(RangeError);
    expect(() => encodeQ(-1)).toThrow(RangeError);
    expect(() => encodeFreq(70000)).toThrow(RangeError);
    expect(() => encodeFreq(-1)).toThrow(RangeError);
    expect(() => buildFrame('get', 0x18, new Uint8Array(0), 0x10000)).toThrow(RangeError);
    expect(() => buildFrame('get', 0x18, new Uint8Array(0), -1)).toThrow(RangeError);
    expect(() => buildFrame('get', 0x15, Uint8Array.of(1), 1.5)).toThrow(RangeError);
  });
  it('round-trips negative gain', () => {
    expect(encodeGain(-6.9)).toEqual(Uint8Array.of(0xff, 0xbb));
    expect(decodeGain(0xff, 0xbb)).toBe(-6.9);
  });
});

describe('band payload', () => {
  it('encodes and decodes', () => {
    const p = encodeBandPayload(0, lsc);
    expect(p).toEqual(hex('00 00 42 00 16 00 49 01'));
    expect(decodeBandPayload(p)).toEqual({ index: 0, band: lsc });
  });
  it('writes disabled bands with gain 0', () => {
    expect(encodeBandPayload(2, { ...lsc, enabled: false }).slice(1, 3)).toEqual(Uint8Array.of(0, 0));
  });
  it('rejects unknown type', () => {
    expect(() => decodeBandPayload(hex('00 00 00 00 64 00 64 09'))).toThrow();
  });
});

describe('createSequence', () => {
  it('counts and wraps', () => {
    const next = createSequence(0xfffe);
    expect([next(), next(), next(), next()]).toEqual([0xfffe, 0xffff, 0, 1]);
  });
  it('crc sanity', () => {
    expect(crc8Maxim(new Uint8Array(0))).toBe(0);
  });
});
