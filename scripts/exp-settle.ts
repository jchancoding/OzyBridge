import type { EqProfile } from '../src/core/eq';
import { connect, log, sleep } from './hid-debug';

const key = (p: EqProfile) => `${p.preamp}|` + p.bands.map((b) => `${b.gain}/${b.q}/${b.freq}`).join(' ');

const a = await connect();
const start = await a.getActiveSlot();
const pairs: [number, number][] = [[0, 165], [160, 169], [169, 162], [0, 161]];

const ref: Record<number, string> = {};
for (const [, s] of pairs) {
  await a.setActiveSlot(s);
  await sleep(2000);
  ref[s] = key(await a.readActiveProfile());
}

// Extra wait after the adapter's own 200 ms switch wait, before a single full read.
for (const extra of [0, 100, 200, 300, 400, 600]) {
  const results: string[] = [];
  for (let trial = 0; trial < 2; trial++) {
    for (const [from, s] of pairs) {
      await a.setActiveSlot(from);
      await sleep(1500);
      await a.setActiveSlot(s);
      await sleep(extra);
      const ok = key(await a.readActiveProfile()) === ref[s];
      results.push(ok ? 'ok' : 'STALE');
    }
  }
  log(`extra ${extra} ms: ${results.join(' ')}`);
}

await a.setActiveSlot(start);
await a.disconnect();
process.exit(0);
