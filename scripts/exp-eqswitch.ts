// Read-only: get 0x1A (FiiO PEQ_SWITCH) and 0x16 a few times. No sets.
import HID from 'node-hid';
import { buildFrame, createSequence, parseReply } from '../src/devices/fiio/protocol';

const info = HID.devices().find((d) => d.vendorId === 0x2972 && d.usagePage === 1)!;
const dev = new HID.HID(info.path!);
const seq = createSequence();
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ');

async function get(cmd: number): Promise<string> {
  const frame = buildFrame('get', cmd, new Uint8Array(), seq());
  const out = new Uint8Array(63);
  out.set(frame);
  return new Promise((resolve) => {
    const timer = setTimeout(() => { dev.removeListener('data', on); resolve('no reply'); }, 1000);
    const on = (buf: Buffer) => {
      const r = parseReply(Uint8Array.from(buf.subarray(1)));
      if (r?.cmd === cmd) { clearTimeout(timer); dev.removeListener('data', on); resolve(hex(r.payload)); }
    };
    dev.on('data', on);
    dev.write([7, ...out]);
  });
}

for (let i = 0; i < 2; i++) {
  console.log(`0x1A -> ${await get(0x1a)}   0x16 -> ${await get(0x16)}`);
}
dev.close();
