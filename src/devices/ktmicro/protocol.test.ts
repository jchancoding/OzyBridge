import { describe, expect, it } from 'vitest';
import { ProtocolError } from '../types';
import allegroMini from './__fixtures__/ktmicro_kiwi_ears_allegro_mini.json';
import allegroPro from './__fixtures__/ktmicro_kiwi_ears_allegro_pro.json';
import chorus from './__fixtures__/ktmicro_kiwi_ears_chorus.json';
import slink from './__fixtures__/ktmicro_kiwi_ears_slink.json';
import chu2 from './__fixtures__/ktmicro_chu2_dsp.json';
import bunny from './__fixtures__/ktmicro_tanchjim_bunny_dsp.json';
import fission from './__fixtures__/ktmicro_tanchjim_fission_dsp.json';
import one from './__fixtures__/ktmicro_tanchjim_one_dsp.json';
import kt02 from './__fixtures__/ktmicro_kt02h20_hifi_audio.json';
import {
  ForbiddenFrameError,
  OP_WRITE,
  REG_DIG_GAIN,
  assertAllowedOutbound,
  bandRegisterPair,
  decodeBand,
  decodeDigitalGainByte,
  decodeEqStateSlot,
  decodeGainFreqReply,
  decodeQTypeReply,
  readBandGainFreq,
  readDigitalGain,
  readEqState,
  readRegister,
} from './protocol';
import type { BandRegisterMap } from './protocol';

interface Exchange {
  send: { data: number[] };
  responses: { data: number[] }[];
}

type CaptureFile = { exchanges: Exchange[] };

function findReadReply(capture: CaptureFile, reg: number): Uint8Array {
  const ex = capture.exchanges.find((e) => e.send.data[0] === reg && e.send.data[4] === 0x52);
  if (!ex) throw new Error(`No read for reg 0x${reg.toString(16)}`);
  return Uint8Array.from(ex.responses[0]!.data);
}

function bandsFromCapture(
  capture: CaptureFile,
  map: BandRegisterMap,
  halfFreq: boolean,
  bandCount: number,
) {
  const out = [];
  for (let i = 0; i < bandCount; i++) {
    const { gainFreq, q } = bandRegisterPair(map, i);
    out.push(decodeBand(findReadReply(capture, gainFreq), findReadReply(capture, q), halfFreq));
  }
  return out;
}

const CHORUS_MAP: BandRegisterMap = {
  baseRegisterOffset: 0x35,
  bandRegisters: [
    { freq: 0x35, q: 0x36 },
    { freq: 0x37, q: 0x38 },
    { freq: 0x39, q: 0x3a },
    { freq: 0x3b, q: 0x3c },
    { freq: 0x3d, q: 0x3f },
  ],
};

const SLINK_MAP: BandRegisterMap = {
  bandRegisters: [
    { freq: 0x37, q: 0x38 },
    { freq: 0x3b, q: 0x3c },
    { freq: 0x3d, q: 0x3f },
    { freq: 0x39, q: 0x3a },
    { freq: 0x35, q: 0x36 },
  ],
};

const FIXTURES: {
  name: string;
  capture: CaptureFile;
  map: BandRegisterMap;
  halfFreq: boolean;
  bands: number;
  freq: number[];
  gain?: number[];
  q?: number[];
}[] = [
  {
    name: 'Allegro Mini',
    capture: allegroMini as CaptureFile,
    map: { baseRegisterOffset: 0x26 },
    halfFreq: false,
    bands: 5,
    freq: [100, 2000, 3000, 8000, 10000],
  },
  {
    name: 'Allegro Pro',
    capture: allegroPro as CaptureFile,
    map: { baseRegisterOffset: 0x26 },
    halfFreq: false,
    bands: 5,
    freq: [18, 56, 930, 5000, 17200],
  },
  {
    name: 'Chorus',
    capture: chorus as CaptureFile,
    map: CHORUS_MAP,
    halfFreq: false,
    bands: 5,
    freq: [61, 105, 184, 243, 316],
    gain: [1.5, -1.4, 1.1, -1.3, 1.3],
    q: [0.7, 0.7, 0.7, 0.7, 0.8],
  },
  {
    name: 'S-Link',
    capture: slink as CaptureFile,
    map: SLINK_MAP,
    halfFreq: false,
    bands: 5,
    freq: [101, 231, 379, 4696, 16788],
    gain: [1.1, -2.3, 3.7, -3.4, 5.8],
    q: [0.7, 0.7, 2.0, 0.7, 0.7],
  },
  {
    name: 'Chu II DSP',
    capture: chu2 as CaptureFile,
    map: { baseRegisterOffset: 0x26 },
    halfFreq: false,
    bands: 5,
    freq: [25, 200, 1400, 3500, 9000],
  },
  {
    name: 'Bunny DSP',
    capture: bunny as CaptureFile,
    map: { baseRegisterOffset: 0x26 },
    halfFreq: false,
    bands: 5,
    freq: [50, 200, 800, 1700, 7500],
  },
  {
    name: 'Fission DSP',
    capture: fission as CaptureFile,
    map: { baseRegisterOffset: 0x26 },
    halfFreq: false,
    bands: 5,
    freq: [30, 200, 1300, 3000, 9000],
    gain: [10, -6.5, -1.2, -4.8, -9.5],
  },
  {
    name: 'One DSP',
    capture: one as CaptureFile,
    map: { baseRegisterOffset: 0x26 },
    halfFreq: false,
    bands: 5,
    freq: [30, 200, 800, 1700, 4500],
  },
];

describe('read encoders match Allegro Mini capture', () => {
  const cap = allegroMini as CaptureFile;
  it('EQ state (0x24)', () => {
    expect([...readEqState()]).toEqual(cap.exchanges[0]!.send.data);
  });
  it('band 0 gain/freq', () => {
    expect([...readBandGainFreq(0)]).toEqual(cap.exchanges[1]!.send.data);
  });
  it('digital gain (0x66)', () => {
    const ex = cap.exchanges.find((e) => e.send.data[0] === REG_DIG_GAIN && e.send.data[4] === 0x52);
    expect([...readDigitalGain()]).toEqual(ex!.send.data);
  });
});

describe('allowlist', () => {
  it('rejects writes, commit, clear, and unknown registers', () => {
    expect(() => readRegister(0x11)).toThrow(ForbiddenFrameError);
    expect(() => assertAllowedOutbound(Uint8Array.of(0x26, 0, 0, 0, OP_WRITE, 0, 0, 0, 0, 0))).toThrow(
      ForbiddenFrameError,
    );
    expect(() => assertAllowedOutbound(Uint8Array.of(0, 0, 0, 0, 0x53, 0, 0, 0, 0, 0))).toThrow(
      ForbiddenFrameError,
    );
    expect(() => assertAllowedOutbound(Uint8Array.of(0, 0, 0, 0, 0x43, 0, 0, 0, 0, 0))).toThrow(
      ForbiddenFrameError,
    );
    expect(() => readRegister(0x30)).toThrow(ForbiddenFrameError);
  });
});

describe('decode from capture replies', () => {
  it('EQ state slot byte matches devicePEQ getCurrentSlot', () => {
    const reply = findReadReply(allegroMini as CaptureFile, 0x24);
    expect(decodeEqStateSlot(reply)).toBe(3);
  });

  it('digital gain byte decodes', () => {
    const reply = findReadReply(allegroMini as CaptureFile, REG_DIG_GAIN);
    expect(typeof decodeDigitalGainByte(reply)).toBe('number');
  });

  it.each(FIXTURES)('$name: band frequencies match devicePEQ', ({ capture, map, halfFreq, bands, freq }) => {
    const decoded = bandsFromCapture(capture, map, halfFreq, bands);
    expect(decoded.map((b) => b.freq)).toEqual(freq);
  });

  it.each(FIXTURES.filter((f) => f.gain))('$name: gains match devicePEQ', ({ capture, map, halfFreq, bands, gain }) => {
    const decoded = bandsFromCapture(capture, map, halfFreq, bands);
    expect(decoded.map((b) => b.gain)).toEqual(gain);
  });

  it.each(FIXTURES.filter((f) => f.q))('$name: Q values match devicePEQ', ({ capture, map, halfFreq, bands, q }) => {
    const decoded = bandsFromCapture(capture, map, halfFreq, bands);
    expect(decoded.map((b) => b.q)).toEqual(q);
  });

  it('KT02H20: decodes five band pairs present in capture', () => {
    const cap = kt02 as CaptureFile;
    const bands = bandsFromCapture(cap, { baseRegisterOffset: 0x26 }, false, 5);
    expect(bands.map((b) => b.freq)).toEqual([150, 10000, 90, 400, 50]);
  });

  it('rejects unsupported filter type bytes', () => {
    const qReply = findReadReply(allegroMini as CaptureFile, 0x27);
    const bad = new Uint8Array(qReply);
    bad[8] = 2;
    expect(() => decodeQTypeReply(bad)).toThrow(ProtocolError);
  });

  it('halfFreq doubles displayed frequency', () => {
    const gf = findReadReply(allegroMini as CaptureFile, 0x26);
    expect(decodeGainFreqReply(gf, true).freq).toBe(decodeGainFreqReply(gf, false).freq * 2);
  });
});
