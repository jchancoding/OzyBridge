import { describe, expect, it } from 'vitest';
import ba15 from './__fixtures__/BA15 REVJET.xml?raw';
import { exportFiioXml, parseFiioXml } from './fiioXml';
import type { EqProfile } from './eq';

function band(i: number, type: string, extra = '') {
  return `<eq index="${i}"><param name="type">${type}</param><param name="freq">100</param><param name="gain">1</param>${extra === 'noq' ? '' : '<param name="q">1</param>'}</eq>`;
}
const wrap = (inner: string, tail = '') =>
  `<FiiO_DSP model="X"><module name="EQ"><eqGroup><param name="masterGain">0</param><eqList>${inner}</eqList></eqGroup></module>${tail}</FiiO_DSP>`;

function errs(text: string) {
  const r = parseFiioXml(text);
  if (r.ok) throw new Error('expected failure');
  return r.errors;
}

describe('parseFiioXml', () => {
  it('parses the BA15 fixture', () => {
    const r = parseFiioXml(ba15);
    if (!r.ok) throw new Error('failed');
    expect(r.model).toBe('FIIO BTR17');
    expect(r.name).toBe('BA15 REVJET');
    expect(r.profile.preamp).toBe(-6);
    expect(r.profile.bands).toHaveLength(10);
    expect(r.profile.bands[0]).toEqual({ type: 'LSC', freq: 42, gain: 6, q: 0.87, enabled: true });
    expect(r.profile.bands[5]).toEqual({ type: 'HSC', freq: 5158, gain: -3, q: 0.8, enabled: true });
    expect(r.profile.bands.slice(6).map((b) => b.gain)).toEqual([0, 0, 0, 0]);
    expect(r.profile.bands.every((b) => b.enabled)).toBe(true);
  });

  it('sorts by index', () => {
    const r = parseFiioXml(wrap(band(1, '2') + band(0, '0')));
    if (!r.ok) throw new Error('failed');
    expect(r.profile.bands.map((b) => b.type)).toEqual(['PK', 'HSC']);
  });

  it('rejects non-FiiO files', () => {
    expect(errs('<foo/>')).toEqual([{ message: "This isn't a FiiO EQ file." }]);
  });

  it('rejects bad type', () => {
    const e = errs(wrap(band(0, '3')));
    expect(e).toHaveLength(1);
    expect(e[0]?.band).toBe(1);
  });

  it('rejects missing q', () => {
    const e = errs(wrap(band(0, '0') + band(1, '0', 'noq')));
    expect(e).toHaveLength(1);
    expect(e[0]?.band).toBe(2);
    expect(e[0]?.message).toContain('"q"');
  });

  it('rejects duplicate and non-contiguous indices', () => {
    const d = errs(wrap(band(0, '0') + band(0, '0')));
    expect(d.some((x) => x.band === 1)).toBe(true);
    const g = errs(wrap(band(0, '0') + band(2, '0')));
    expect(g.map((x) => x.band)).toEqual([2]);
  });

  it('decodes entities in styleName', () => {
    const r = parseFiioXml(wrap(band(0, '0'), '<styleName> A &amp; B &lt;&#65;&#x42;&quot;&apos;&gt; </styleName>'));
    if (!r.ok) throw new Error('failed');
    expect(r.name).toBe('A & B <AB"\'>');
  });

  it('gives null name when absent or empty', () => {
    for (const tail of ['', '<styleName>  </styleName>']) {
      const r = parseFiioXml(wrap(band(0, '0'), tail));
      if (!r.ok) throw new Error('failed');
      expect(r.name).toBeNull();
    }
  });
});

describe('exportFiioXml', () => {
  it('reproduces the fixture byte for byte', () => {
    const r = parseFiioXml(ba15);
    if (!r.ok) throw new Error('failed');
    const desc = /<description>([^<]*)<\/description>/.exec(ba15)![1]!;
    expect(exportFiioXml(r.profile, { model: r.model!, name: r.name!, description: desc })).toBe(ba15);
  });

  it('round trips all types, negative preamp and a disabled band', () => {
    const p: EqProfile = {
      preamp: -4.5,
      bands: [
        { type: 'LSC', freq: 42, gain: 6, q: 0.87, enabled: true },
        { type: 'PK', freq: 1000, gain: -3.2, q: 1.2, enabled: true },
        { type: 'HSC', freq: 8000, gain: 2, q: 0.7, enabled: false },
      ],
    };
    const r = parseFiioXml(exportFiioXml(p, { model: 'FIIO BTR17' }));
    if (!r.ok) throw new Error('failed');
    expect(r.profile.preamp).toBe(-4.5);
    expect(r.profile.bands).toEqual([...p.bands.slice(0, 2), { ...p.bands[2]!, gain: 0, enabled: true }]);
  });

  it('escapes special characters', () => {
    const name = `A&B <x> "q" 'z'`;
    const r = parseFiioXml(
      exportFiioXml({ preamp: 0, bands: [{ type: 'PK', freq: 100, gain: 1, q: 1, enabled: true }] }, { model: 'M&', name }),
    );
    if (!r.ok) throw new Error('failed');
    expect(r.name).toBe(name);
    expect(r.model).toBe('M&');
  });
});
