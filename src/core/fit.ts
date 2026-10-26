import { flatBand } from './eq';
import type { EqBand, EqIssue, EqLimits, EqProfile } from './eq';
import { logFrequencies, profileResponseDb } from './response';

export type FitResult =
  | { ok: true; profile: EqProfile; notes: string[] }
  | { ok: false; errors: EqIssue[] };

function decimals(step: number): number {
  const s = String(step);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

function fix(v: number, step: number): number {
  const r = Number((v).toFixed(decimals(step)));
  return r === 0 ? 0 : r;
}

function roundStep(v: number, step: number): number {
  const q = Math.abs(v) / step;
  const n = Math.floor(q + 0.5 + 1e-9);
  return fix(Math.sign(v) * n * step, step);
}

function floorStep(v: number, step: number): number {
  return fix(Math.floor(v / step + 1e-9) * step, step);
}

const signed = (v: number, d: number) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`;

export function fitProfile(profile: EqProfile, limits: EqLimits, fs = 48000): FitResult {
  const notes: string[] = [];
  const active = profile.bands.filter((b) => b.enabled);
  const dropped = profile.bands.length - active.length;
  if (dropped > 0) notes.push(`Skipped ${dropped} filter(s) marked OFF.`);

  let changed = false;
  const bands: EqBand[] = active.map((b) => {
    const r = {
      ...b,
      gain: roundStep(b.gain, limits.step.gain),
      q: roundStep(b.q, limits.step.q),
      freq: roundStep(b.freq, limits.step.freq),
    };
    if (r.gain !== b.gain || r.q !== b.q || r.freq !== b.freq) changed = true;
    return r;
  });

  const errors: EqIssue[] = [];
  if (bands.length > limits.maxBands) {
    const extra = bands.length - limits.maxBands;
    errors.push({
      message: `This EQ has ${bands.length} active filters, but the device has ${limits.maxBands} bands. Remove ${extra} filter${extra === 1 ? '' : 's'} and import again.`,
    });
  }
  const gd = decimals(limits.step.gain);
  const qd = decimals(limits.step.q);
  const fd = decimals(limits.step.freq);
  bands.forEach((b, i) => {
    const n = i + 1;
    if (!limits.filterTypes.includes(b.type)) {
      errors.push({
        band: n,
        message: `Filter ${n}: filter type ${b.type} is not supported by this device. Change it to a supported type (${limits.filterTypes.join(', ')}).`,
      });
    }
    if (b.gain > limits.gain.max) {
      errors.push({ band: n, message: `Filter ${n}: gain ${signed(b.gain, gd)} dB is above the device maximum of ${signed(limits.gain.max, gd)} dB.` });
    } else if (b.gain < limits.gain.min) {
      errors.push({ band: n, message: `Filter ${n}: gain ${signed(b.gain, gd)} dB is below the device minimum of ${signed(limits.gain.min, gd)} dB.` });
    }
    if (b.q > limits.q.max) {
      errors.push({ band: n, message: `Filter ${n}: Q ${b.q.toFixed(qd)} is above the device maximum of ${limits.q.max.toFixed(qd)}.` });
    } else if (b.q < limits.q.min) {
      errors.push({ band: n, message: `Filter ${n}: Q ${b.q.toFixed(qd)} is below the device minimum of ${limits.q.min.toFixed(qd)}.` });
    }
    if (b.freq > limits.freq.max) {
      errors.push({ band: n, message: `Filter ${n}: frequency ${b.freq.toFixed(fd)} Hz is above the device maximum of ${limits.freq.max.toFixed(fd)} Hz.` });
    } else if (b.freq < limits.freq.min) {
      errors.push({ band: n, message: `Filter ${n}: frequency ${b.freq.toFixed(fd)} Hz is below the device minimum of ${limits.freq.min.toFixed(fd)} Hz.` });
    }
  });
  if (errors.length > 0) return { ok: false, errors };

  const grid = [
    ...logFrequencies(2000),
    ...bands.map((b) => Math.min(20000, Math.max(20, b.freq))),
  ];
  const peak = Math.max(...profileResponseDb({ preamp: 0, bands }, grid, fs, false));
  const needed = -Math.max(0, peak);
  if (profile.preamp > limits.preamp.max) {
    return {
      ok: false,
      errors: [{ message: `The preamp of ${signed(profile.preamp, gd)} dB is above the device maximum of ${signed(limits.preamp.max, gd)} dB. Lower the preamp and import again.` }],
    };
  }
  const preamp = floorStep(Math.min(profile.preamp, needed), limits.step.gain);
  if (preamp < limits.preamp.min) {
    return {
      ok: false,
      errors: [{ message: `This EQ needs ${Math.abs(preamp).toFixed(gd)} dB of preamp to avoid clipping, but the device only goes down to ${limits.preamp.min.toFixed(gd)} dB. Reduce the boost on your largest filters.` }],
    };
  }
  if (preamp < profile.preamp) {
    notes.push(`Preamp lowered from ${profile.preamp} dB to ${preamp} dB to prevent clipping.`);
  }
  if (changed) {
    notes.push(`Rounded to device precision (gain ${limits.step.gain} dB, Q ${limits.step.q}, frequency ${limits.step.freq} Hz).`);
  }

  const out = [...bands];
  for (let i = out.length; i < limits.maxBands; i++) {
    out.push({ ...flatBand(limits.defaultFreqs?.[i] ?? 1000), enabled: false });
  }
  return { ok: true, profile: { preamp, bands: out }, notes };
}
