import { describe, expect, it } from 'vitest';
import { measurementUrls, parsePhoneBook, parseSquigSites } from './squiglink';

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
