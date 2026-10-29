import { formatBandLine } from '../core/report';
import { HidTransport, TransportTimeoutError, hasOutputReport, type HidLike } from '../transport/webhid';
import * as kt from './ktmicro/protocol';
import * as wp from './walkplay/protocol';

export const FAMILY_PROBE_REPORT_ID = 0x4b;

export interface FamilyProbeResult {
  lines: string[];
  rawHex: string[];
}

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ').toUpperCase();
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function canFamilyProbe(device: Pick<HIDDevice, 'collections'>): boolean {
  return hasOutputReport(device, FAMILY_PROBE_REPORT_ID);
}

/**
 * Read-only identification for unlisted devices on report 0x4B. Sends only the WalkPlay and
 * KTMicro read frames from their protocol modules (which reject anything that is not a read).
 */
export async function runFamilyProbe(device: HidLike, timeoutMs = 800): Promise<FamilyProbeResult> {
  const transport = new HidTransport(device, { reportId: FAMILY_PROBE_REPORT_ID, timeoutMs, minGapMs: 20 });
  const rawHex: string[] = [];
  transport.tap((dir, data) => rawHex.push(`${dir} ${hex(data)}`));
  const lines: string[] = [];
  await transport.open();

  const ask = async (label: string, frame: Uint8Array, match: (r: Uint8Array) => boolean, decode: (r: Uint8Array) => string) => {
    try {
      const reply = await transport.request(frame, match);
      try {
        lines.push(`${label}: ${decode(reply)}`);
      } catch (e) {
        lines.push(`${label}: reply did not decode (${msg(e)})`);
      }
    } catch (e) {
      lines.push(`${label}: ${e instanceof TransportTimeoutError ? 'no reply' : msg(e)}`);
    }
  };

  try {
    await ask('walkplay firmware', wp.readFirmware(), (r) => wp.matchReply(r, wp.CMD.VERSION), (r) => wp.decodeFirmware(r) || '(empty)');
    await ask('walkplay band 1', wp.readPeqBand(0), (r) => wp.matchReply(r, wp.CMD.PEQ_VALUES), (r) => formatBandLine(wp.decodePeqBand(r)));
    let gainFreq: Uint8Array | null = null;
    await ask('ktmicro eq state', kt.readEqState(), (r) => kt.matchReply(r, kt.REG_EQ_STATE), (r) => `slot ${kt.decodeEqStateSlot(r)}`);
    await ask('ktmicro band 1 gain/freq', kt.readBandGainFreq(0), (r) => kt.matchReply(r, kt.REG_BAND_BASE), (r) => {
      gainFreq = r;
      const { freq, gain } = kt.decodeGainFreqReply(r, false);
      return `${freq} Hz ${gain} dB`;
    });
    await ask('ktmicro band 1 q/type', kt.readBandQType(0), (r) => kt.matchReply(r, kt.REG_BAND_BASE + 1), (r) => {
      const qt = kt.decodeQTypeReply(r);
      return gainFreq ? formatBandLine(kt.decodeBand(gainFreq, r, false)) : `Q ${qt.q} ${qt.type}`;
    });
  } finally {
    await transport.close().catch(() => {});
  }
  return { lines, rawHex };
}
