// End-to-end check of the adapter's readSlot over every user slot, starting from a built-in preset.
import type { EqProfile } from '../src/core/eq';
import { connect, log, sleep } from './hid-debug';

const key = (p: EqProfile) => `${p.preamp}|` + p.bands.map((b) => `${b.gain}/${b.q}/${b.freq}`).join(' ');
const slots = [160, 161, 162, 163, 164, 165, 166, 167, 168, 169];

const a = await connect();
const start = await a.getActiveSlot();

const ref: Record<number, string> = {};
for (const s of slots) {
  await a.setActiveSlot(s);
  await sleep(2000);
  ref[s] = key(await a.readActiveProfile());
}

for (const from of [Number(process.env.FROM ?? 0), 160]) {
  await a.setActiveSlot(from);
  await sleep(1500);
  const t = Date.now();
  const bad = [];
  for (const s of slots) if (key(await a.readSlot(s)) !== ref[s]) bad.push(s);
  log(`readSlot x10 from ${from}: ${bad.length ? `STALE ${bad.join(',')}` : 'all match'} in ${Date.now() - t} ms, active now ${await a.getActiveSlot()}`);
}

await a.setActiveSlot(start);
await a.disconnect();
process.exit(0);
