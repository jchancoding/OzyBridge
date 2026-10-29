import { describe, expect, it } from 'vitest';
import {
  commonSpelling,
  measurementUrls,
  modelIdentity,
  normalizeSearch,
  parsePhoneBook,
  parseSquigSites,
} from './squiglink';

describe('modelIdentity', () => {
  const key = (brand: string, name: string) => modelIdentity(brand, name).key;

  it('merges casing, punctuation and spacing differences', () => {
    expect(key('7HZ', 'DIABLO')).toBe(key('7hz', 'Diablo'));
    expect(key('Truthear', 'Zero: Red')).toBe(key('TRUTHEAR', 'Zero RED'));
    expect(key('Truthear', 'Zero:Red')).toBe(key('Truthear', 'Zero Red'));
    expect(key('Truthear', 'Zero Blue2')).toBe(key('Truthear', 'Zero Blue 2'));
    expect(key('7Hz', 'Salnotes Zero ')).toBe(key('7Hz', 'Salnotes Zero'));
    expect(key('TRUTHEAR', 'ZERO II')).toBe(key('Truthear', 'Zero 2'));
  });

  it('merges collaborations regardless of which field holds the partner', () => {
    const crin = key('Truthear', 'x Crinacle Zero: Red');
    expect(key('TRUTHEAR × Crinacle', 'ZERO: RED')).toBe(crin);
    expect(key('TruthEar', ' x Crinacle Zero: Red')).toBe(crin);
    expect(key('Tangzu', 'Wu x HBB')).toBe(key('TangZu x HBB', 'Wu'));
  });

  it('ignores word order and filler words', () => {
    const wu = key('Tangzu', 'Zetian Wu Legend');
    expect(key('TANGZU', 'Wu Zetian Legend')).toBe(wu);
    expect(key('TangZu', 'Zetian Wu The Legend')).toBe(wu);
    expect(key('TANGZU x HBB', 'Wu Zetian (Heyday Edition)')).toBe(key('TangZu X HBB', 'Zetian Wu Heyday'));
  });

  it('keeps collaborations apart from the base model', () => {
    expect(key('TangZu', 'Wu x HBB')).not.toBe(key('TangZu', 'Wu'));
    expect(key('Truthear', 'x Crinacle Zero Red')).not.toBe(key('Truthear', 'Zero Red'));
  });

  it('treats Salnotes as 7Hz', () => {
    const zero2 = key('7Hz', 'Zero 2');
    expect(key('7Hz', 'Salnotes Zero 2')).toBe(zero2);
    expect(key('7hz Salnotes', 'Zero 2')).toBe(zero2);
    expect(key('7HZ', 'SALNOTES ZERO 2')).toBe(zero2);
    expect(key('7Hz/Salnotes', 'Zero')).toBe(key('Salnotes', 'Zero'));
    expect(key('7hz-Salnotes', 'x Crinacle ZERO:2')).toBe(key('7Hz', 'x Crinacle Zero 2'));
  });

  it('keeps different models apart', () => {
    const keys = [
      key('7Hz', 'Zero'),
      key('7Hz', 'Zero 2'),
      key('7Hz', 'Zero 3'),
      key('Truthear', 'Zero'),
      key('Truthear', 'Zero Red'),
      key('Truthear', 'Zero Blue 2'),
      key('Tanchjim', 'Zero Ultima'),
      key('Tanchjim', 'Zero Ultima (DSP)'),
      key('CrinEar', 'Diablo'),
      key('7Hz', 'Diablo'),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('moves sample, unit and adapter notes into the detail', () => {
    expect(modelIdentity('7Hz × Crinacle', 'Zero 2 (sample 01)')).toEqual({
      key: key('7Hz', 'x Crinacle Zero 2'),
      spelling: '7Hz × Crinacle Zero 2',
      detail: '(sample 01)',
    });
    expect(modelIdentity('7Hz', 'Diablo Set#2').detail).toBe('Set#2');
    expect(modelIdentity('Truthear', 'Zero: Red S1')).toMatchObject({ spelling: 'Truthear Zero: Red', detail: 'S1' });
    expect(modelIdentity('Truthear', 'Zero Red 10 Ohm').detail).toBe('10 Ohm');
    expect(modelIdentity('TRUTHEAR', 'ZERO II IMP').detail).toBe('IMP');
    expect(modelIdentity('7Hz', 'Salnotes Zero 2 Stock Tip').detail).toBe('Stock Tip');
    expect(modelIdentity('TANGZU', 'Wukong (Demo)').detail).toBe('(Demo)');
    expect(modelIdentity('Truthear', 'x Crinacle Zero:BLUE2 (5Ω Impedance Adapter)').detail).toBe('(5Ω Impedance Adapter)');
  });

  it('keeps model names that only look like details', () => {
    expect(modelIdentity('Moondrop', 'S8')).toMatchObject({ spelling: 'Moondrop S8', detail: '' });
    expect(modelIdentity('Tanchjim', 'Zero Ultima (DSP)').detail).toBe('');
  });

  it('does not repeat a brand already in the name', () => {
    expect(modelIdentity('7Hz', '7Hz Zero').spelling).toBe('7Hz Zero');
  });
});

describe('normalizeSearch', () => {
  it('splits glued numbers and drops punctuation', () => {
    expect(normalizeSearch('Zero:Blue2')).toBe('zero blue 2');
  });
});

describe('commonSpelling', () => {
  it('picks the most common spelling, then avoids all caps', () => {
    expect(commonSpelling(['7HZ DIABLO', '7Hz Diablo', '7Hz Diablo'])).toBe('7Hz Diablo');
    expect(commonSpelling(['7HZ DIABLO', '7hz Diablo'])).toBe('7hz Diablo');
  });
});

describe('parseSquigSites', () => {
  const site = (urlType: string, extra: Record<string, unknown> = {}) => ({
    username: 'crin',
    name: 'Crinacle',
    urlType,
    dbs: [{ type: 'IEM', folder: '/data/' }],
    ...extra,
  });

  it('skips Hangout.Audio, which blocks direct file access', () => {
    expect(parseSquigSites([site('altDomain', { username: 'crinacle', altDomain: 'https://graph.hangout.audio' })])).toEqual([]);
  });

  it('builds subdomain URLs', () => {
    const [db] = parseSquigSites([site('subdomain')]);
    expect(db?.baseUrl).toBe('https://crin.squig.link/data/');
  });

  it('builds labFolder URLs', () => {
    const [db] = parseSquigSites([site('labFolder')]);
    expect(db?.baseUrl).toBe('https://squig.link/lab/crin/data/');
  });

  it('builds altDomain URLs', () => {
    const [db] = parseSquigSites([
      site('altDomain', { altDomain: 'https://example.com' }),
    ]);
    expect(db?.baseUrl).toBe('https://example.com/data/');
  });

  it('builds root URLs', () => {
    const [db] = parseSquigSites([site('root')]);
    expect(db?.baseUrl).toBe('https://squig.link/data/');
  });

  it('skips unknown urlType and non-https altDomain', () => {
    expect(parseSquigSites([site('weird')])).toEqual([]);
    expect(
      parseSquigSites([site('altDomain', { altDomain: 'http://insecure.com' })]),
    ).toEqual([]);
  });

  it('sorts by reviewer name case-insensitively', () => {
    const out = parseSquigSites([
      { ...site('root'), name: 'zebra' },
      { ...site('root'), name: 'Alpha' },
    ]);
    expect(out.map((d) => d.reviewer)).toEqual(['Alpha', 'zebra']);
  });
});

describe('parsePhoneBook', () => {
  it('parses a string phone', () => {
    const [model] = parsePhoneBook([{ name: 'Brand', phones: ['Model A'] }]);
    expect(model).toEqual({
      brand: 'Brand',
      name: 'Model A',
      variants: [{ label: '', file: 'Model A' }],
    });
  });

  it('expands file arrays with suffix labels', () => {
    const [model] = parsePhoneBook([
      {
        name: 'Brand',
        phones: [
          {
            name: 'Multi',
            file: ['a.txt', 'b.txt'],
            suffix: ['Tip', 'Ring'],
          },
        ],
      },
    ]);
    expect(model?.variants).toEqual([
      { label: 'Tip', file: 'a.txt' },
      { label: 'Ring', file: 'b.txt' },
    ]);
  });

  it('uses file names as labels when multiple files and no suffix', () => {
    const [model] = parsePhoneBook([
      {
        name: 'Brand',
        phones: [{ name: 'Multi', file: ['path/foo.txt', 'bar.txt'] }],
      },
    ]);
    expect(model?.variants[0]?.label).toBe('foo.txt');
    expect(model?.variants[1]?.label).toBe('bar.txt');
  });

  it('skips _EQ and underscore brands', () => {
    expect(
      parsePhoneBook([
        { name: '_EQ', phones: ['x'] },
        { name: '_hidden', phones: ['y'] },
        { name: 'OK', phones: ['z'] },
      ]),
    ).toEqual([{ brand: 'OK', name: 'z', variants: [{ label: '', file: 'z' }] }]);
  });

  it('sorts by brand then name', () => {
    const out = parsePhoneBook([
      { name: 'B', phones: ['z', 'a'] },
      { name: 'A', phones: ['m'] },
    ]);
    expect(out.map((m) => `${m.brand}/${m.name}`)).toEqual(['A/m', 'B/a', 'B/z']);
  });
});

describe('measurementUrls', () => {
  it('encodes spaces in file names', () => {
    const [l, r] = measurementUrls('https://x.squig.link/data/', 'My IEM');
    expect(l).toBe('https://x.squig.link/data/data/My%20IEM%20L.txt');
    expect(r).toBe('https://x.squig.link/data/data/My%20IEM%20R.txt');
  });
});
