// Read-only: runs probeFiio (GET frames only) on the first HID interface with output report 7.
import HID from 'node-hid';
import { probeFiio } from '../src/devices/fiio/probe';
import type { HidLike } from '../src/transport/webhid';

const vid = Number(process.env.VID ?? 0x0a12);
const pid = Number(process.env.PID ?? 0x4007);
const info = HID.devices().find((d) => d.vendorId === vid && d.productId === pid && d.usagePage === 0xff00);
if (!info?.path) throw new Error('device not found');
const dev = new HID.HID(info.path);
const target = new EventTarget();
dev.on('data', (buf: Buffer) => {
  const e = new Event('inputreport') as Event & { reportId: number; data: DataView };
  e.reportId = buf[0]!;
  e.data = new DataView(Uint8Array.from(buf.subarray(1)).buffer);
  target.dispatchEvent(e);
});
let opened = false;
const hid = {
  get opened() { return opened; },
  open: async () => { opened = true; },
  close: async () => { opened = false; dev.close(); },
  sendReport: async (id: number, data: BufferSource) => {
    const bytes = new Uint8Array(data instanceof ArrayBuffer ? data : (data as Uint8Array).buffer);
    dev.write([id, ...bytes]);
  },
  addEventListener: target.addEventListener.bind(target),
  removeEventListener: target.removeEventListener.bind(target),
  collections: [{ usagePage: 0xff00, usage: 1, outputReports: [{ reportId: 7, items: [{ reportSize: 8, reportCount: 64 }] }] }],
  productName: info.product ?? '',
  vendorId: vid,
  productId: pid,
} as unknown as HidLike;
for (const l of await probeFiio(hid, { timeoutMs: 1500 })) console.log(l);
process.exit(0);
