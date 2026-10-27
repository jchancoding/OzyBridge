import type { EqProfile } from '../src/core/eq';
import { connect, log, sleep } from './hid-debug';

const fmt = (p: EqProfile) => `pre ${p.preamp} | ` + p.bands.map((b) => `${b.freq}:${b.gain}/${b.q}`).join(' ');

const a = await connect();
const start = await a.getActiveSlot();
log(`active at start: ${start}`);
const target = Number(process.env.SLOT ?? 169);

await a.setActiveSlot(160);
log(`truth ${target} (from USER1): ${fmt(await a.readSlot(target))}`);

for (const wait of [0, 1000, 3000]) {
  await a.setActiveSlot(0);
  await a.setActiveSlot(target);
  await sleep(wait);
  log(`from Jazz, wait ${wait}: ${fmt(await a.readActiveProfile())}`);
  log(`   read again:        ${fmt(await a.readActiveProfile())}`);
}

await a.setActiveSlot(start);
log(`restored ${await a.getActiveSlot()}`);
await a.disconnect();
process.exit(0);
