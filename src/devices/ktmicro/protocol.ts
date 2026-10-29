import type { EqBand, FilterType } from '../../core/eq';
import { ProtocolError } from '../types';

export const REPORT_ID = 0x4b;
export const OP_READ = 0x52;
export const OP_WRITE = 0x57;
export const OP_COMMIT = 0x53;
export const OP_CLEAR = 0x43;

export const REG_EQ_STATE = 0x24;
export const REG_DIG_GAIN = 0x66;
export const REG_BAND_BASE = 0x26;

const ALLOWED_READ_REGS: ReadonlySet<number> = new Set([
  REG_EQ_STATE,
  REG_DIG_GAIN,
  0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d, 0x2e, 0x2f,
]);

export interface BandRegisterMap {
  baseRegisterOffset?: number;
  bandRegisters?: readonly { freq: number; q: number }[];
}

export class ForbiddenFrameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenFrameError';
  }
}

export function assertAllowedOutbound(frame: Uint8Array): void {
  if (frame.length < 10) throw new ForbiddenFrameError('KTMicro frame too short');
  if (frame[4] !== OP_READ) throw new ForbiddenFrameError(`Forbidden KTMicro op 0x${frame[4]!.toString(16)}`);
  const reg = frame[0]!;
  if (!ALLOWED_READ_REGS.has(reg)) {
    throw new ForbiddenFrameError(`Forbidden KTMicro register 0x${reg.toString(16)}`);
  }
  if (frame[1] !== 0 || frame[2] !== 0 || frame[3] !== 0 || frame[5] !== 0) {
    throw new ForbiddenFrameError('Unexpected KTMicro read padding');
  }
  if (reg === REG_EQ_STATE) {
    if (frame[6] !== 0x03 || frame[7] !== 0 || frame[8] !== 0 || frame[9] !== 0) {
      throw new ForbiddenFrameError('Unexpected KTMicro 0x24 read tail');
    }
    return;
  }
  if (frame[6] !== 0 || frame[7] !== 0 || frame[8] !== 0 || frame[9] !== 0) {
    throw new ForbiddenFrameError('Unexpected KTMicro read tail');
  }
}

export function bandRegisterPair(map: BandRegisterMap, bandIndex: number): { gainFreq: number; q: number } {
  const explicit = map.bandRegisters?.[bandIndex];
  if (explicit) return { gainFreq: explicit.freq, q: explicit.q };
  const base = map.baseRegisterOffset ?? REG_BAND_BASE;
  const gainFreq = base + bandIndex * 2;
  return { gainFreq, q: gainFreq + 1 };
}

/** Read EQ state / current slot (`0x24`, byte 6 of request is `0x03` in captures). */
export function readEqState(): Uint8Array {
  const frame = Uint8Array.of(REG_EQ_STATE, 0, 0, 0, OP_READ, 0, 0x03, 0, 0, 0);
  assertAllowedOutbound(frame);
  return frame;
}

export function readRegister(reg: number): Uint8Array {
  if (!ALLOWED_READ_REGS.has(reg)) throw new ForbiddenFrameError(`Forbidden KTMicro register 0x${reg.toString(16)}`);
  if (reg === REG_EQ_STATE) return readEqState();
  const frame = Uint8Array.of(reg, 0, 0, 0, OP_READ, 0, 0, 0, 0, 0);
  assertAllowedOutbound(frame);
  return frame;
}

export function readBandGainFreq(bandIndex: number, map: BandRegisterMap = {}): Uint8Array {
  return readRegister(bandRegisterPair(map, bandIndex).gainFreq);
}

export function readBandQType(bandIndex: number, map: BandRegisterMap = {}): Uint8Array {
  return readRegister(bandRegisterPair(map, bandIndex).q);
}

export function readDigitalGain(): Uint8Array {
  return readRegister(REG_DIG_GAIN);
}

export function matchReply(reply: Uint8Array, reg: number): boolean {
  return reply.length >= 5 && reply[0] === reg && reply[4] === OP_READ;
}

export function decodeEqStateSlot(reply: Uint8Array): number {
  if (!matchReply(reply, REG_EQ_STATE)) throw new Error('Not an EQ state reply');
  return reply[6] ?? 0;
}

/** Register 0x66 byte 6: devicePEQ pregain integer; ktmicro-tools documents signed half-dB DAC digital gain. */
export function decodeDigitalGainByte(reply: Uint8Array): number {
  if (!matchReply(reply, REG_DIG_GAIN)) throw new Error('Not a digital gain reply');
  const raw = reply[6] ?? 0;
  return raw > 127 ? raw - 256 : raw;
}

function wireTypeToFilter(byte: number): FilterType {
  if (byte === 3) return 'LSC';
  if (byte === 4) return 'HSC';
  if (byte === 0) return 'PK';
  throw new ProtocolError(`Unsupported KTMicro filter type byte 0x${byte.toString(16)}`);
}

export function decodeGainFreqReply(reply: Uint8Array, halfFreq: boolean): Pick<EqBand, 'freq' | 'gain'> {
  const reg = reply[0]!;
  if (!matchReply(reply, reg)) throw new Error('Not a gain/freq reply');
  const gainRaw = reply[6]! | (reply[7]! << 8);
  const gainSigned = gainRaw > 0x7fff ? gainRaw - 0x10000 : gainRaw;
  const gain = Math.round((gainSigned / 10) * 100) / 100;
  let freq = reply[8]! + (reply[9]! << 8);
  if (halfFreq) freq *= 2;
  return { freq, gain };
}

export function decodeQTypeReply(reply: Uint8Array): Pick<EqBand, 'q' | 'type'> {
  const reg = reply[0]!;
  if (!matchReply(reply, reg)) throw new Error('Not a Q/type reply');
  const q = Math.round(((reply[6]! + (reply[7]! << 8)) / 1000) * 1000) / 1000;
  const type = wireTypeToFilter(reply[8]!);
  return { q, type };
}

export function decodeBand(gainFreqReply: Uint8Array, qTypeReply: Uint8Array, halfFreq: boolean): EqBand {
  const { freq, gain } = decodeGainFreqReply(gainFreqReply, halfFreq);
  const { q, type } = decodeQTypeReply(qTypeReply);
  const enabled = freq > 0 && q > 0;
  return { type, freq: enabled ? freq : 0, gain: enabled ? gain : 0, q: enabled ? q : 0, enabled };
}
