// BTR13 power-cycle test. PHASE=write: back up USER2 to /tmp, write test change, leave it.
// PHASE=check (after unplug/replug): read USER2, compare to test, restore backup, verify.
import { readFileSync, writeFileSync } from 'node:fs';
import HID from 'node-hid';
import { connectFiio } from '../src/devices/fiio/adapter';
import { profilesEqual, type EqProfile } from '../src/core/eq';
import { testPreset } from '../src/core/report';
import type { HidLike } from '../src/transport/webhid';

const FILE = '/tmp/btr13-replug.json';
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

const fmt = (p: EqProfile) => `preamp ${p.preamp} | ` + p.bands.map((b) => `${b.type} ${b.freq}/${b.gain}/${b.q}`).join(', ');
const slot = 8;
const a = await connectFiio(hid, { hid: new EventTarget() });
console.log(`active slot: ${await a.getActiveSlot()}`);
if (process.env.PHASE === 'check') {
  const { backup, test } = JSON.parse(readFileSync(FILE, 'utf8')) as { backup: EqProfile; test: EqProfile };
  const r = await a.readSlot(slot);
  console.log(`after replug ${fmt(r)}`);
  console.log(`REPLUG ${profilesEqual(r, test) ? 'PASS' : 'FAIL'}`);
  await a.writeSlot(slot, backup);
  const rr = await a.readSlot(slot);
  console.log(`RESTORE ${profilesEqual(rr, backup) ? 'PASS' : 'FAIL'} ${fmt(rr)}`);
} else {
  const backup = await a.readSlot(slot);
  const test = testPreset(a.capabilities, backup);
  writeFileSync(FILE, JSON.stringify({ backup, test }));
  await a.writeSlot(slot, test);
  const rb = await a.readSlot(slot);
  console.log(`WRITE ${profilesEqual(rb, test) ? 'PASS' : 'FAIL'} ${fmt(rb)}`);
}
await a.disconnect();
process.exit(0);
