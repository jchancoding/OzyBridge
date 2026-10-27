// End-to-end check of the adapter's batch readSlots over every user slot, from a built-in preset and from a user slot.
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

for (const from of [0, 164]) {
  await a.setActiveSlot(from);
  await sleep(1500);
  const ids = [...slots].sort((x, y) => Number(y === from) - Number(x === from));
  const t = Date.now();
  const bad: number[] = [];
  let first = -1;
  await a.readSlots!(ids, (id, p) => {
    if (first < 0) first = Date.now() - t;
    if (key(p) !== ref[id]) bad.push(id);
  });
  log(`readSlots from ${from}: ${bad.length ? `STALE ${bad.join(',')}` : 'all match'}, first card ${first} ms, all ${Date.now() - t} ms, active now ${await a.getActiveSlot()}`);
}

await a.setActiveSlot(start);
await a.disconnect();
process.exit(0);
