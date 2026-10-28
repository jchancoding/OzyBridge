import { averageChannels, parseMeasurement, type Measurement } from '../core/measurement';
import {
  measurementUrls,
  parsePhoneBook,
  parseSquigSites,
  type SquigDb,
  type SquigModel,
} from '../core/squiglink';

const SITES_URL = 'https://squig.link/squigsites.json';
const TIMEOUT_MS = 15000;

const cache = new Map<string, Promise<unknown>>();

async function get(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'GET', credentials: 'omit', signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

export function loadDbs(): Promise<SquigDb[]> {
  return cached(SITES_URL, async () => parseSquigSites(JSON.parse(await get(SITES_URL))));
}

export function loadModels(db: SquigDb): Promise<SquigModel[]> {
  const url = `${db.baseUrl}data/phone_book.json`;
  return cached(url, async () => parsePhoneBook(JSON.parse(await get(url))));
}

export function loadMeasurement(db: SquigDb, file: string): Promise<Measurement> {
  const [lUrl, rUrl] = measurementUrls(db.baseUrl, file);
  return cached(lUrl, async () => {
    const [l, r] = await Promise.allSettled([get(lUrl), get(rUrl)]);
    const parse = (s: PromiseSettledResult<string>): Measurement | null => {
      if (s.status !== 'fulfilled') return null;
      try {
        return parseMeasurement(s.value);
      } catch {
        return null;
      }
    };
    const a = parse(l);
    const b = parse(r);
    if (a && b) return averageChannels(a, b);
    const one = a ?? b;
    if (!one) throw new Error('Measurement could not be loaded');
    return one;
  });
}
