import { describe, expect, it } from 'vitest';
import { ProtocolError } from '../types';
import marigold from './__fixtures__/walkplay_default_moondrop_marigold.json';
import schemeno15Ddhifi from './__fixtures__/walkplay_schemeno15_ddhifi_dsp_cable.json';
import schemeno15Stargate from './__fixtures__/walkplay_schemeno15_tanchjim_stargate_ii.json';
import schemeno16ProtocolMax from './__fixtures__/walkplay_schemeno16_protocol_max.json';
import schemeno16Tp35 from './__fixtures__/walkplay_schemeno16_tp35_pro.json';
import schemeno16SpacePro from './__fixtures__/walkplay_schemeno16_tanchjim_space_pro.json';
import schemeno18Octave from './__fixtures__/walkplay_schemeno18_nicehck_octave.json';
import {
  ForbiddenCommandError,
  buildReadRequest,
  decodeFirmware,
  decodeGlobalGain,
  decodePeqBand,
  readFirmware,
  readGlobalGain,
  readPeqBand,
  readPeqSlot,
} from './protocol';

interface Exchange {
  send: { data: number[] };
  responses: { data: number[] }[];
  description?: string;
}

type CaptureFile = { exchanges: Exchange[] };

function isPeqBandRead(send: number[]): boolean {
  return (
    send.length === 6 &&
    send[0] === 0x80 &&
    send[1] === 0x09 &&
    send[2] === 0x00 &&
    send[3] === 0x00 &&
    send[5] === 0x00
  );
}

function peqBandExchanges(capture: CaptureFile): Exchange[] {
  const seen = new Set<number>();
  const out: Exchange[] = [];
  for (const e of capture.exchanges) {
    if (!isPeqBandRead(e.send.data)) continue;
    const i = e.send.data[4]!;
    if (seen.has(i)) continue;
    seen.add(i);
    out.push(e);
  }
  return out.sort((a, b) => a.send.data[4]! - b.send.data[4]!);
}

function bandReplies(capture: CaptureFile): Uint8Array[] {
  return peqBandExchanges(capture).map((e) => Uint8Array.from(e.responses[0]!.data));
}

const CAPTURES: { name: string; capture: CaptureFile; bands: number }[] = [
  { name: 'Marigold', capture: marigold as CaptureFile, bands: 8 },
  { name: 'ddHiFi DSP Cable', capture: schemeno15Ddhifi as CaptureFile, bands: 8 },
  { name: 'STARGATE II', capture: schemeno15Stargate as CaptureFile, bands: 8 },
  { name: 'Protocol Max', capture: schemeno16ProtocolMax as CaptureFile, bands: 10 },
  { name: 'TP35 Pro', capture: schemeno16Tp35 as CaptureFile, bands: 10 },
  { name: 'SPACE PRO', capture: schemeno16SpacePro as CaptureFile, bands: 10 },
  { name: 'Octave', capture: schemeno18Octave as CaptureFile, bands: 10 },
];

const marigoldSends = (marigold as CaptureFile).exchanges.map((e) => e.send.data);

describe('read encoders match Marigold capture', () => {
  it('firmware', () => {
    expect([...readFirmware()]).toEqual(marigoldSends[0]);
  });
  it('PEQ slot query', () => {
    expect([...readPeqSlot()]).toEqual(marigoldSends[1]);
  });
  it.each([0, 1, 2, 3, 4, 5, 6, 7])('PEQ band %i', (i) => {
    expect([...readPeqBand(i)]).toEqual(marigoldSends[2 + i]);
  });
  it('global gain', () => {
    expect([...readGlobalGain()]).toEqual(marigoldSends[10]);
  });
});

describe('allowlist', () => {
  it('rejects commands outside the read slice', () => {
    expect(() => buildReadRequest(0x02)).toThrow(ForbiddenCommandError);
    expect(() => readPeqBand(999)).toThrow(RangeError);
  });
});

describe('decode from capture replies', () => {
  const marigoldEx = (marigold as CaptureFile).exchanges;

  it('Marigold firmware', () => {
    const data = Uint8Array.from(marigoldEx[0]!.responses[0]!.data);
    expect(decodeFirmware(data)).toBe('0.1');
  });

  it('Marigold global gain', () => {
    const data = Uint8Array.from(marigoldEx[10]!.responses[0]!.data);
    expect(decodeGlobalGain(data)).toBe(0);
  });

  it.each(CAPTURES)('$name: all PEQ bands decode', ({ capture, bands }) => {
    const replies = bandReplies(capture);
    expect(replies).toHaveLength(bands);
    for (const raw of replies) {
      expect(() => decodePeqBand(raw)).not.toThrow();
    }
  });

  it('rejects LP and HP type bytes', () => {
    const pkReply = bandReplies(marigold as CaptureFile)[0]!;
    const lp = new Uint8Array(pkReply);
    lp[33] = 4;
    const hp = new Uint8Array(pkReply);
    hp[33] = 5;
    expect(() => decodePeqBand(lp)).toThrow(ProtocolError);
    expect(() => decodePeqBand(hp)).toThrow(ProtocolError);
  });
});
