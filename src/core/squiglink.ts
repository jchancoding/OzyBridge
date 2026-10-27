export interface SquigDb {
  reviewer: string;
  type: string;
  baseUrl: string;
}

export interface SquigModel {
  brand: string;
  name: string;
  variants: { label: string; file: string }[];
}

function trailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function squigBaseUrl(
  urlType: string,
  username: string,
  folder: string,
  altDomain?: string,
): string | null {
  let url: string;
  switch (urlType) {
    case 'subdomain':
      url = `https://${username}.squig.link${folder}`;
      break;
    case 'labFolder':
      url = `https://squig.link/lab/${username}${folder}`;
      break;
    case 'altDomain':
      if (typeof altDomain !== 'string') return null;
      url = `${altDomain}${folder}`;
      break;
    case 'root':
      url = `https://squig.link${folder}`;
      break;
    default:
      return null;
  }
  if (!url.startsWith('https://')) return null;
  return trailingSlash(url);
}

const BLOCKED_REVIEWERS = new Set(['crinacle']);

export function parseSquigSites(json: unknown): SquigDb[] {
  if (!Array.isArray(json)) return [];
  const out: SquigDb[] = [];
  for (const entry of json) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const name = e.name;
    const username = e.username;
    const urlType = e.urlType;
    const dbs = e.dbs;
    if (typeof name !== 'string' || typeof username !== 'string' || typeof urlType !== 'string') {
      continue;
    }
    if (!Array.isArray(dbs)) continue;
    // Hangout.Audio (crinacle) blocks direct file access and encrypts its data; do not work around it.
    if (BLOCKED_REVIEWERS.has(username)) continue;
    const altDomain = e.altDomain;
    for (const db of dbs) {
      if (!db || typeof db !== 'object') continue;
      const d = db as Record<string, unknown>;
      if (typeof d.type !== 'string' || typeof d.folder !== 'string') continue;
      const baseUrl = squigBaseUrl(urlType, username, d.folder, altDomain as string | undefined);
      if (!baseUrl) continue;
      out.push({ reviewer: name, type: d.type, baseUrl });
    }
  }
  out.sort((a, b) => a.reviewer.localeCompare(b.reviewer, undefined, { sensitivity: 'accent' }));
  return out;
}

function fileBaseName(file: string): string {
  const slash = file.lastIndexOf('/');
  return slash >= 0 ? file.slice(slash + 1) : file;
}

function phoneVariants(
  files: string[],
  suffix?: string[],
): { label: string; file: string }[] {
  const multi = files.length > 1;
  return files.map((file, i) => {
    let label = '';
    if (suffix && i < suffix.length && suffix[i] !== undefined) {
      label = suffix[i];
    } else if (multi) {
      label = fileBaseName(file);
    }
    return { label, file };
  });
}

export function parsePhoneBook(json: unknown): SquigModel[] {
  if (!Array.isArray(json)) return [];
  const out: SquigModel[] = [];
  for (const entry of json) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const brand = e.name;
    const phones = e.phones;
    if (typeof brand !== 'string' || brand === '_EQ' || brand.startsWith('_')) continue;
    if (!Array.isArray(phones)) continue;
    for (const phone of phones) {
      if (typeof phone === 'string') {
        out.push({ brand, name: phone, variants: [{ label: '', file: phone }] });
        continue;
      }
      if (!phone || typeof phone !== 'object') continue;
      const p = phone as Record<string, unknown>;
      const name = p.name;
      const file = p.file;
      if (typeof name !== 'string') continue;
      let files: string[];
      if (typeof file === 'string') files = [file];
      else if (Array.isArray(file) && file.every((x) => typeof x === 'string')) files = file as string[];
      else continue;
      const suffix = p.suffix;
      const suffixArr =
        suffix === undefined
          ? undefined
          : Array.isArray(suffix) && suffix.every((x) => typeof x === 'string')
            ? (suffix as string[])
            : undefined;
      if (suffix !== undefined && !suffixArr) continue;
      out.push({ brand, name, variants: phoneVariants(files, suffixArr) });
    }
  }
  out.sort((a, b) => {
    const byBrand = a.brand.localeCompare(b.brand, undefined, { sensitivity: 'accent' });
    if (byBrand !== 0) return byBrand;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'accent' });
  });
  return out;
}

export function measurementUrls(baseUrl: string, file: string): [string, string] {
  const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const l = `${root}data/${encodeURIComponent(`${file} L`)}.txt`;
  const r = `${root}data/${encodeURIComponent(`${file} R`)}.txt`;
  return [l, r];
}
