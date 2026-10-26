import type { EqBand, EqProfile } from '../../core/eq';
import type { HidLike } from '../../transport/webhid';
import { FIIO_VENDOR_ID } from './models';
import { crc8Maxim, decodeBandPayload, decodeGain, encodeBandPayload, encodeGain } from './protocol';

export interface SentFrame { kind: 'set' | 'get'; cmd: number; payload: Uint8Array; at: number }

const DEFAULT_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const flat = (): EqProfile => ({
  preamp: 0,
  bands: DEFAULT_FREQS.map((freq): EqBand => ({ type: 'PK', freq, gain: 0, q: 1, enabled: true })),
});

export class FakeFiioHid {
  opened = false;
  productName: string;
  vendorId = FIIO_VENDOR_ID;
  productId: number;
  reportId: number;
  collections: HIDCollectionInfo[];

  constructor(opts: { productId?: number; productName?: string; reportId?: number } = {}) {
    this.productId = opts.productId ?? 0x0088;
    this.productName = opts.productName ?? 'FIIO BTR17';
    this.reportId = opts.reportId ?? 7;
    this.collections = [
      { outputReports: [{ reportId: this.reportId, items: [{ reportSize: 8, reportCount: 32 }] }] },
    ] as unknown as HIDCollectionInfo[];
  }

  bandCount = 10;
  silentCmds = new Set<number>();
  badCrcCmds = new Set<number>();
  corruptBandWrites = false;
  ignoreSlotSwitch = false;
  replyToSets = false;
  firmware = Uint8Array.from([...'1.2.3'].map((c) => c.charCodeAt(0)));

  slots = new Map<number, EqProfile>();
  active = 160;
  saved: number[] = [];
  sent: SentFrame[] = [];

  private handlers = new Set<(e: Event) => void>();

  slot(id: number): EqProfile {
    let p = this.slots.get(id);
    if (!p) {
      p = flat();
      this.slots.set(id, p);
    }
    return p;
  }

  open = async () => { this.opened = true; };
  close = async () => { this.opened = false; };
  addEventListener = (_t: string, h: EventListenerOrEventListenerObject) => {
    this.handlers.add(h as (e: Event) => void);
  };
  removeEventListener = (_t: string, h: EventListenerOrEventListenerObject) => {
    this.handlers.delete(h as (e: Event) => void);
  };

  sendReport = async (_id: number, data: BufferSource) => {
    const b = data as Uint8Array;
    const n = b[5]!;
    const kind = b[0] === 0xaa ? 'set' : 'get';
    const cmd = b[4]!;
    const payload = b.slice(6, 6 + n);
    this.sent.push({ kind, cmd, payload, at: Date.now() });
    const reply = this.handle(kind, cmd, payload);
    if (reply && !this.silentCmds.has(cmd) && (kind === 'get' || this.replyToSets)) {
      queueMicrotask(() => this.emit(this.frame(cmd, reply)));
    }
  };

  private handle(kind: 'set' | 'get', cmd: number, p: Uint8Array): Uint8Array | null {
    const cur = this.slot(this.active);
    switch (cmd) {
      case 0x0b:
        return this.firmware;
      case 0x18:
        return Uint8Array.of(this.bandCount);
      case 0x16:
        if (kind === 'set' && !this.ignoreSlotSwitch) this.active = p[0]!;
        return kind === 'set' ? p : Uint8Array.of(this.active);
      case 0x17:
        if (kind === 'set') {
          cur.preamp = decodeGain(p[0]!, p[1]!);
          return p;
        }
        return encodeGain(cur.preamp);
      case 0x19:
        this.saved.push(p[0]!);
        return p;
      case 0x15:
        if (kind === 'set') {
          const { index, band } = decodeBandPayload(p);
          if (this.corruptBandWrites) band.gain += 1;
          cur.bands[index] = band;
          return null;
        }
        return encodeBandPayload(p[0]!, cur.bands[p[0]!]!);
      default:
        return null;
    }
  }

  // Matches the real BTR17: sequence 0 and CRC byte 0 in every reply.
  private frame(cmd: number, payload: Uint8Array): Uint8Array {
    const f = new Uint8Array(32);
    f.set([0xbb, 0x0b, 0, 0, cmd, payload.length]);
    f.set(payload, 6);
    const crc = crc8Maxim(f.subarray(0, 6 + payload.length));
    f[6 + payload.length] = this.badCrcCmds.has(cmd) ? (crc ^ 0xff) || 1 : 0;
    f[7 + payload.length] = 0xee;
    return f;
  }

  private emit(bytes: Uint8Array) {
    const data = new DataView(bytes.buffer);
    for (const h of [...this.handlers]) h({ reportId: this.reportId, data } as unknown as Event);
  }

  asHid(): HidLike {
    return this as unknown as HidLike;
  }
}
