import type { EqBand, FilterType } from '../../core/eq';
import { ProtocolError } from '../types';

export const REPORT_ID = 0x4b;
export const READ = 0x80;
export const END = 0x00;

export const CMD = {
  GLOBAL_GAIN: 0x03,
  PEQ_VALUES: 0x09,
  VERSION: 0x0c,
} as const;

export type ReadCmd = (typeof CMD)[keyof typeof CMD];

const ALLOWED_READS: ReadonlySet<number> = new Set([CMD.VERSION, CMD.PEQ_VALUES, CMD.GLOBAL_GAIN]);

export class ForbiddenCommandError extends Error {
  constructor(cmd: number) {
    super(`Forbidden WalkPlay command 0x${cmd.toString(16).padStart(2, '0')}`);
    this.name = 'ForbiddenCommandError';
  }
}

export class ForbiddenDirectionError extends Error {
  constructor() {
    super('WalkPlay writes are not enabled in this build');
    this.name = 'ForbiddenDirectionError';
  }
}

function assertReadCmd(cmd: number): void {
  if (!ALLOWED_READS.has(cmd)) throw new ForbiddenCommandError(cmd);
}

export function buildReadRequest(cmd: number, tail: number[] = []): Uint8Array {
  assertReadCmd(cmd);
  if (tail.some((b) => !Number.isInteger(b) || b < 0 || b > 255)) {
    throw new RangeError('tail byte out of range');
  }
  return Uint8Array.of(READ, cmd, ...tail);
}

/** Read firmware version (`80 0C 00`). */
export function readFirmware(): Uint8Array {
  assertReadCmd(CMD.VERSION);
  return Uint8Array.of(READ, CMD.VERSION, END);
}

/** Bulk PEQ read used for current-slot query (`80 09 00`). */
export function readPeqSlot(): Uint8Array {
  assertReadCmd(CMD.PEQ_VALUES);
  return Uint8Array.of(READ, CMD.PEQ_VALUES, END);
}

/** Read one PEQ band (`80 09 00 00 <band> 00`). */
export function readPeqBand(band: number): Uint8Array {
  assertReadCmd(CMD.PEQ_VALUES);
  if (!Number.isInteger(band) || band < 0 || band > 255) throw new RangeError(`band out of range: ${band}`);
  return Uint8Array.of(READ, CMD.PEQ_VALUES, END, 0x00, band, END);
}

/** Read global DAC gain register (`80 03 00`). */
export function readGlobalGain(): Uint8Array {
  assertReadCmd(CMD.GLOBAL_GAIN);
  return Uint8Array.of(READ, CMD.GLOBAL_GAIN, END);
}

export function matchReply(reply: Uint8Array, cmd: number): boolean {
  return reply.length >= 2 && reply[0] === READ && reply[1] === cmd;
}

export function decodeFirmware(reply: Uint8Array): string {
  if (!matchReply(reply, CMD.VERSION)) throw new Error('Not a firmware reply');
  const bytes = reply.slice(3).filter((b) => b >= 0x20 && b <= 0x7e);
  return bytes.length ? String.fromCharCode(...bytes) : '';
}

export function decodeGlobalGain(reply: Uint8Array): number {
  if (!matchReply(reply, CMD.GLOBAL_GAIN)) throw new Error('Not a global gain reply');
  const raw = reply[4] ?? 0;
  return raw > 127 ? raw - 256 : raw;
}

function wireTypeToFilter(byte: number): FilterType {
  switch (byte) {
    case 1:
      return 'LSC';
    case 2:
      return 'PK';
    case 3:
      return 'HSC';
    default:
      throw new ProtocolError(`Unsupported WalkPlay filter type byte 0x${byte.toString(16)}`);
  }
}

/** Schemes 10, 15, 16, 18 pull path: no frequency or Q compensation. */
export function decodePeqBand(reply: Uint8Array): EqBand {
  if (!matchReply(reply, CMD.PEQ_VALUES)) throw new Error('Not a PEQ reply');
  if (reply.length < 34) throw new Error('PEQ reply too short');

  const freqRaw = reply[27]! | (reply[28]! << 8);
  let gainRaw = reply[31]! | (reply[32]! << 8);
  if (gainRaw > 32767) gainRaw -= 65536;
  const gain = Math.round((gainRaw / 256) * 100) / 100;
  const type = wireTypeToFilter(reply[33]!);
  const qRaw = reply[29]! | (reply[30]! << 8);
  const q = Math.round((qRaw / 256) * 100) / 100;

  const metadataCorrupted = freqRaw === 65535 && qRaw === 65535 && gainRaw === -1;
  if (metadataCorrupted) {
    return { type, freq: 0, gain: 0, q: 0, enabled: false };
  }

  const valid = !(freqRaw === 65535 || freqRaw === 0 || q === 0 || (freqRaw === 0 && q === 0 && gain === 0));
  return {
    type,
    freq: valid ? freqRaw : 0,
    gain: valid ? gain : 0,
    q: valid ? q : 0,
    enabled: valid,
  };
}
