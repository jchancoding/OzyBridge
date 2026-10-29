// BTR13 bench: read USER2, write one test change, read back, restore, verify. Documented commands only.
import HID from 'node-hid';
import { connectFiio } from '../src/devices/fiio/adapter';
import { profilesEqual } from '../src/core/eq';
import { testPreset } from '../src/core/report';
import type { HidLike } from '../src/transport/webhid';

const info = HID.devices().find((d) => d.vendorId === 0x0a12 && d.productId === 0x4007 && d.usagePage === 0xff00);
if (!info?.path) throw new Error('BTR13 not found');
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
    const b = new Uint8Array(data instanceof ArrayBuffer ? data : (data as Uint8Array).buffer);
    dev.write([id, ...b]);
  },
  addEventListener: target.addEventListener.bind(target),
  removeEventListener: target.removeEventListener.bind(target),
  collections: [{ usagePage: 0xff00, usage: 1, outputReports: [{ reportId: 7, items: [{ reportSize: 8, reportCount: 64 }] }] }],
  productName: info.product ?? '',
  vendorId: 0x0a12,
  productId: 0x4007,
} as unknown as HidLike;

const fmt = (p: { preamp: number; bands: { type: string; freq: number; gain: number; q: number }[] }) =>
  `preamp ${p.preamp} | ` + p.bands.map((b) => `${b.type} ${b.freq}/${b.gain}/${b.q}`).join(', ');
const t0 = Date.now();
const log = (s: string) => console.log(`${String(Date.now() - t0).padStart(6)} ${s}`);

const a = await connectFiio(hid, { hid: new EventTarget() });
const slot = 8;
log(`active slot: ${await a.getActiveSlot()}`);
const backup = await a.readSlot(slot);
log(`backup  ${fmt(backup)}`);
const test = testPreset(a.capabilities, backup);
log(`test    ${fmt(test)}`);
try {
  await a.writeSlot(slot, test);
  const rb = await a.readSlot(slot);
  log(`readback ${fmt(rb)}`);
  log(`WRITE ${profilesEqual(rb, test) ? 'PASS' : 'FAIL'}`);
} catch (e) {
  log(`WRITE ERROR ${e instanceof Error ? e.message : String(e)}`);
} finally {
  await a.writeSlot(slot, backup).catch((e) => log(`RESTORE ERROR ${e}`));
  const r = await a.readSlot(slot);
  log(`RESTORE ${profilesEqual(r, backup) ? 'PASS' : 'FAIL'} ${fmt(r)}`);
  await a.disconnect();
  process.exit(0);
}
