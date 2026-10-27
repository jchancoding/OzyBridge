import { describe, expect, it } from 'vitest';
import a2000 from './__fixtures__/autoeq-a2000-10band.txt?raw';
import ba15 from './__fixtures__/BA15 REVJET.xml?raw';
import { exportAutoEq, parseAutoEq } from './autoeq';
import type { EqLimits, EqProfile } from './eq';
import { parseFiioXml } from './fiioXml';
import { fitProfile } from './fit';
import { logFrequencies, profileResponseDb } from './response';

const BTR17: EqLimits = {
  maxBands: 10, filterTypes: ['PK', 'LSC', 'HSC'],
  gain: { min: -24, max: 12 }, preamp: { min: -24, max: 12 },
  q: { min: 0.25, max: 8 }, freq: { min: 20, max: 20000 },
  step: { gain: 0.1, q: 0.01, freq: 1 },
  defaultFreqs: [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
};

const peakWithPreamp = (p: EqProfile) => Math.max(...profileResponseDb(p, logFrequencies(2000)));

describe('file to device pipeline', () => {
  it('fits the A2000 AutoEQ file and keeps its preamp', () => {
    const parsed = parseAutoEq(a2000);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const fit = fitProfile(parsed.profile, BTR17);
    if (!fit.ok) throw new Error(JSON.stringify(fit.errors));
    expect(fit.profile.bands).toHaveLength(10);
    expect(fit.profile.preamp).toBe(-6.9);
    expect(fit.notes.some((n) => n.startsWith('Preamp lowered'))).toBe(false);
    expect(peakWithPreamp(fit.profile)).toBeLessThanOrEqual(0);
  });

  it('fits the BA15 FiiO file, keeps its preamp and warns about clipping', () => {
    const parsed = parseFiioXml(ba15);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const fit = fitProfile(parsed.profile, BTR17);
    if (!fit.ok) throw new Error(JSON.stringify(fit.errors));
    expect(fit.profile.preamp).toBe(-6);
    expect(fit.warnings).toHaveLength(1);
    expect(fit.warnings[0]).toContain('-6.1 dB or lower');
  });

  it('exports a fitted profile that parses and fits back unchanged', () => {
    const parsed = parseAutoEq(a2000);
    if (!parsed.ok) throw new Error('parse failed');
    const fit = fitProfile(parsed.profile, BTR17);
    if (!fit.ok) throw new Error('fit failed');
    const again = parseAutoEq(exportAutoEq(fit.profile));
    if (!again.ok) throw new Error('re-parse failed');
    const refit = fitProfile(again.profile, BTR17);
    expect(refit.ok && refit.profile).toEqual(fit.profile);
  });
});
