import { describe, expect, it } from 'vitest';
import capture from './__fixtures__/walkplay_default_moondrop_marigold.json';
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

const sends = (capture as { exchanges: Exchange[] }).exchanges.map((e) => e.send.data);

describe('read encoders match Marigold capture', () => {
  it('firmware', () => {
    expect([...readFirmware()]).toEqual(sends[0]);
  });
  it('PEQ slot query', () => {
    expect([...readPeqSlot()]).toEqual(sends[1]);
  });
  it.each([0, 1, 2, 3, 4, 5, 6, 7])('PEQ band %i', (i) => {
    expect([...readPeqBand(i)]).toEqual(sends[2 + i]);
  });
  it('global gain', () => {
    expect([...readGlobalGain()]).toEqual(sends[10]);
  });
});

describe('allowlist', () => {
  it('rejects commands outside the read slice', () => {
    expect(() => buildReadRequest(0x02)).toThrow(ForbiddenCommandError);
    expect(() => readPeqBand(999)).toThrow(RangeError);
  });
});

describe('decode from capture replies', () => {
  const exchanges = (capture as { exchanges: Exchange[] }).exchanges;

  it('firmware', () => {
    const data = Uint8Array.from(exchanges[0]!.responses[0]!.data);
    expect(decodeFirmware(data)).toBe('0.1');
  });

  it('global gain', () => {
    const data = Uint8Array.from(exchanges[10]!.responses[0]!.data);
    expect(decodeGlobalGain(data)).toBe(0);
  });

  it('eight PEQ bands', () => {
    const bands = [2, 3, 4, 5, 6, 7, 8, 9].map((i) =>
      decodePeqBand(Uint8Array.from(exchanges[i]!.responses[0]!.data)),
    );
    expect(bands).toHaveLength(8);
    expect(bands[0]).toMatchObject({ type: 'PK', freq: 25, gain: 0, q: 0.5, enabled: true });
    expect(bands[7]).toMatchObject({ type: 'PK', freq: 10630, gain: 0, q: 7, enabled: true });
  });
});
