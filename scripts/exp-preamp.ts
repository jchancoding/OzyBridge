// Hardware check for the preamp-keep behaviour: writes preamp -2 dB with one +5.8 dB band to USER10 through
// fitProfile, reads it back, then restores USER10 and the active slot. Needs EQ switched on in the device.
import { fitProfile } from '../src/core/fit';
import { connect, log } from './hid-debug';

const SLOT = 169;
const a = await connect();
const start = await a.getActiveSlot();
const backup = await a.readSlot(SLOT);
log(`start slot ${start}; USER10 backup preamp ${backup.preamp}`);
try {
  const want = { preamp: -2, bands: backup.bands.map((b, i) => (i === 3 ? { ...b, gain: 5.8, enabled: true } : b)) };
  const fit = fitProfile(want, a.capabilities);
  if (!fit.ok) throw new Error(fit.errors.map((e) => e.message).join(' '));
  log(`fit preamp ${fit.profile.preamp}; warnings: ${fit.warnings.join(' ') || 'none'}`);
  const back = await a.writeSlot(SLOT, fit.profile);
  log(`write read-back preamp ${back.preamp}`);
  const again = await a.readSlot(SLOT);
  log(`fresh read preamp ${again.preamp}, band 4 gain ${again.bands[3]!.gain} -> ${again.preamp === -2 ? 'PASS' : 'FAIL'}`);
} finally {
  await a.writeSlot(SLOT, backup);
  const r = await a.readSlot(SLOT);
  log(`restored USER10 preamp ${r.preamp}`);
  await a.setActiveSlot(start);
  await a.disconnect();
}
process.exit(0);
