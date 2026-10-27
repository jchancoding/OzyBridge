// Local bench harness: drives a BTR17 over node-hid using the real FiiO adapter. Read-only commands plus 0x16 slot switches.
import HID from 'node-hid';
import { connectFiio } from '../src/devices/fiio/adapter';
import type { HidLike } from '../src/transport/webhid';

const REPORT_ID = 7;
const OUT_LEN = Number(process.env.OUT_LEN ?? 63);

function open(): HidLike {
  const info = HID.devices().find((d) => d.vendorId === 0x2972 && d.usagePage === 1);
  if (!info?.path) throw new Error('BTR17 not found');
  const dev = new HID.HID(info.path);
  const target = new EventTarget();
  dev.on('data', (buf: Buffer) => {
    const e = new Event('inputreport') as Event & { reportId: number; data: DataView };
    e.reportId = buf[0]!;
    e.data = new DataView(Uint8Array.from(buf.subarray(1)).buffer);
    target.dispatchEvent(e);
  });
  let opened = false;
  return {
    get opened() { return opened; },
    open: async () => { opened = true; },
    close: async () => { opened = false; dev.close(); },
    sendReport: async (id: number, data: BufferSource) => {
      const bytes = new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer);
      dev.write([id, ...bytes]);
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    collections: [{ outputReports: [{ reportId: REPORT_ID, items: [{ reportSize: 8, reportCount: OUT_LEN }] }] }],
    productName: info.product ?? 'BTR17',
    vendorId: info.vendorId,
    productId: info.productId,
  } as unknown as HidLike;
}

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ');
const t0 = Date.now();
const log = (s: string) => console.log(`${String(Date.now() - t0).padStart(6)} ${s}`);
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function connect(verbose = process.env.VERBOSE === '1') {
  return connectFiio(open(), {
    hid: new EventTarget(),
    log: verbose ? (dir, bytes) => log(`${dir === 'out' ? '>>' : '<<'} ${hex(bytes)}`) : undefined,
  });
}
export { log };
