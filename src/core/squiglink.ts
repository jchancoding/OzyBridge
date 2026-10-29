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

export interface ModelIdentity {
  key: string;
  spelling: string;
  detail: string;
}

const DETAIL_WORDS =
  /\b(?:samples?|unit|set|s\d{1,2}|tips?|foam|silicone|fit|insert|ohms?|imp|impedance|adapter|bass|cable|nozzle|filter|stock|coupler|prototype|pre ?production|demo|retail)\b|[Ωω]|#\d/i;

const TRAILING_DETAIL: RegExp[] = [
  /\s+((?:sample|unit|set)\s*#?\s*\d+|#\d+|s\d{1,2})$/i,
  /\s+(\+?\s*\d+\s*(?:ohms?|[Ωω])(?:\s+(?:impedance\s+)?adapter)?)$/i,
  /\s+(imp|\+\s*bass|bass\s*\+|(?:stock\s+)?tips?|demo|retail)$/i,
];

const FILLER_WORDS = new Set(['the', 'edition']);

function stripDetail(name: string): { name: string; detail: string } {
  let rest = name.normalize('NFKC').replace(/\s+/g, ' ').trim();
  const details: string[] = [];
  for (;;) {
    let cut: { at: number; text: string } | null = null;
    const paren = /\s*\(([^()]*)\)$/.exec(rest);
    if (paren && DETAIL_WORDS.test(paren[1] ?? '')) cut = { at: paren.index, text: paren[0].trim() };
    for (const re of TRAILING_DETAIL) {
      if (cut) break;
      const m = re.exec(rest);
      if (m) cut = { at: m.index, text: (m[1] ?? '').trim() };
    }
    if (!cut) break;
    const next = rest.slice(0, cut.at).replace(/[\s:,-]+$/, '').trim();
    if (!next) break;
    details.unshift(cut.text);
    rest = next;
  }
  return { name: rest, detail: details.join(' ') };
}

export function normalizeSearch(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/×/g, ' x ')
    .replace(/&/g, ' n ')
    .replace(/(\p{L})(\d)/gu, '$1 $2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean)
    .map((t) => (t === 'ii' ? '2' : t === 'iii' ? '3' : t))
    .join(' ');
}

function withBrand(brand: string, name: string, norm: (s: string) => string): string {
  const b = norm(brand);
  const n = norm(name);
  if (!b || n === b || n.startsWith(`${b} `)) return name;
  return `${brand} ${name}`;
}

export function modelIdentity(brand: string, name: string): ModelIdentity {
  const stripped = stripDetail(name);
  const cleanBrand = brand.normalize('NFKC').replace(/\s+/g, ' ').trim();
  const spelling = withBrand(cleanBrand, stripped.name, normalizeSearch).replace(/\s+/g, ' ').trim();
  // Salnotes is 7Hz's own product line, not a collaboration partner.
  const tokens = normalizeSearch(spelling)
    .replace(/^(?:7hz )?(?:x )?salnotes\b/, '7hz')
    .split(' ')
    .filter((t) => t && !FILLER_WORDS.has(t))
    .sort();
  const key = tokens.length > 0 ? tokens.join(' ') : spelling.toLowerCase();
  return { key, spelling, detail: stripped.detail };
}

function isAllCaps(s: string): boolean {
  return /\p{Lu}/u.test(s) && !/\p{Ll}/u.test(s);
}

export function commonSpelling(spellings: string[]): string {
  const counts = new Map<string, number>();
  for (const s of spellings) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()].sort(
    ([a, ca], [b, cb]) =>
      cb - ca ||
      Number(isAllCaps(a)) - Number(isAllCaps(b)) ||
      a.localeCompare(b, undefined, { sensitivity: 'accent' }),
  )[0]?.[0] ?? '';
}

export function measurementUrls(baseUrl: string, file: string): [string, string] {
  const root = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const l = `${root}data/${encodeURIComponent(`${file} L`)}.txt`;
  const r = `${root}data/${encodeURIComponent(`${file} R`)}.txt`;
  return [l, r];
}
