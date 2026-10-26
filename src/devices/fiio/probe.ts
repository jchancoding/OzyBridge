import { HidTransport, hasOutputReport, type HidLike } from '../../transport/webhid';
import {
  createSequence,
  decodeBandPayload,
  decodeFreq,
  decodeGain,
  decodeQ,
  getActivePreset,
  getBand,
  getBandCount,
  getFirmware,
  getPreamp,
  parseReply,
} from './protocol';

const REPORT_ID = 7;
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ').toUpperCase();
const hex4 = (n: number) => n.toString(16).padStart(4, '0').toUpperCase();
const msg = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

function describeCollections(d: HidLike): string[] {
  if (d.collections.length === 0) return ['collections: none'];
  return d.collections.map((c, i) => {
    const ids = (kind: string, rs?: HIDReportInfo[]) =>
      rs && rs.length ? ` ${kind}[${rs.map((r) => r.reportId).join(',')}]` : '';
    const page = `0x${(c.usagePage ?? 0).toString(16)}/0x${(c.usage ?? 0).toString(16)}`;
    return `collection ${i}: ${page}${ids('in', c.inputReports)}${ids('out', c.outputReports)}${ids('feat', c.featureReports)}`;
  });
}

function ascii(b: Uint8Array): string {
  return [...b].map((x) => (x >= 0x20 && x < 0x7f ? String.fromCharCode(x) : '.')).join('');
}

// Read-only: only GET frames are ever built here.
export async function probeFiio(device: HidLike, opts: { timeoutMs?: number } = {}): Promise<string[]> {
  const out: string[] = [];
  const say = (l: string) => out.push(l);
  say(`device: ${device.productName || '(no name)'}`);
  say(`vendorId: 0x${hex4(device.vendorId)}, productId: 0x${hex4(device.productId)}`);
  describeCollections(device).forEach(say);
  if (!hasOutputReport(device, REPORT_ID)) {
    say(`no collection has output report ${REPORT_ID}; nothing sent`);
    return out;
  }

  const transport = new HidTransport(device, { reportId: REPORT_ID, timeoutMs: opts.timeoutMs ?? 1000 });
  const nextSeq = createSequence();
  const get = async (name: string, build: (seq: number) => Uint8Array, cmd: number) => {
    const seq = nextSeq();
    const raw = await transport.request(build(seq), (r) => parseReply(r)?.cmd === cmd);
    const reply = parseReply(raw)!;
    const crc = reply.crcOk ? 'ok' : raw[6 + reply.payload.length] === 0 ? 'not set' : 'mismatch';
    say(`${name}: reply payload ${hex(reply.payload) || '(empty)'} (crc ${crc})`);
    return reply.payload;
  };
  const step = async <T>(name: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (e) {
      say(`${name}: FAILED ${msg(e)}`);
      return undefined;
    }
  };

  try {
    await transport.open();
    let count: number | undefined;
    await step('band count (0x18)', async () => {
      const p = await get('band count (0x18)', getBandCount, 0x18);
      count = p[0];
      say(`  band count: ${count}`);
    });
    await step('firmware (0x0B)', async () => {
      const p = await get('firmware (0x0B)', getFirmware, 0x0b);
      say(`  firmware: ${ascii(p)}`);
    });
    await step('active preset (0x16)', async () => {
      const p = await get('active preset (0x16)', getActivePreset, 0x16);
      say(`  active preset id: ${p[0]}`);
    });
    await step('preamp (0x17)', async () => {
      const p = await get('preamp (0x17)', getPreamp, 0x17);
      if (p.length < 2) throw new RangeError(`preamp payload is ${p.length} bytes`);
      say(`  preamp: ${decodeGain(p[0]!, p[1]!)} dB`);
    });
    const n = count && count > 0 ? count : 10;
    for (let i = 0; i < n; i++) {
      const name = `band ${i} (0x15)`;
      await step(name, async () => {
        const p = await get(name, (s) => getBand(i, s), 0x15);
        try {
          const { band } = decodeBandPayload(p);
          say(`  band ${i}: ${band.type} ${band.freq} Hz ${band.gain} dB Q ${band.q}`);
        } catch {
          if (p.length === 8) {
            say(`  band ${i}: ${decodeFreq(p[3]!, p[4]!)} Hz ${decodeGain(p[1]!, p[2]!)} dB Q ${decodeQ(p[5]!, p[6]!)} filter code ${p[7]} (unknown)`);          } else say(`  band ${i}: cannot decode, payload is ${p.length} bytes`);
        }
      });
    }
  } catch (e) {
    say(`open FAILED ${msg(e)}`);
  } finally {
    await transport.close().catch((e) => say(`close FAILED ${msg(e)}`));
  }
  return out;
}
