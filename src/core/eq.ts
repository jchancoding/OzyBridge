export type FilterType = 'PK' | 'LSC' | 'HSC';
export interface EqBand { type: FilterType; freq: number; gain: number; q: number; enabled: boolean }
export interface EqProfile { preamp: number; bands: EqBand[] }
export interface Range { min: number; max: number }

export interface EqLimits {
  maxBands: number; filterTypes: FilterType[];
  gain: Range; preamp: Range; q: Range; freq: Range;
  step: { gain: number; q: number; freq: number };
  defaultFreqs?: number[];
  // `q` is the wire range; user-facing Q is converted with this law.
  qLaw?: 'rbjGain';
}

// `message` is shown to the user as-is: plain language, says what to change.
export interface EqIssue { message: string; line?: number; band?: number }

export type ImportResult =
  | { ok: true; profile: EqProfile; name: string | null; notes: string[] }
  | { ok: false; errors: EqIssue[] };

export function flatBand(freq: number): EqBand {
  return { type: 'PK', freq, gain: 0, q: 1, enabled: true };
}

const DEFAULT_TOL = { gain: 0.05, freq: 0.5, q: 0.005 };

function bandsEqual(a: EqBand, b: EqBand, tol: typeof DEFAULT_TOL): boolean {
  const aOff = !a.enabled;
  const bOff = !b.enabled;
  if (aOff || bOff) {
    // A disabled band is equivalent to an enabled band with zero gain.
    const other = aOff ? b : a;
    if (aOff && bOff) return true;
    return Math.abs(other.gain) <= tol.gain;
  }
  return (
    a.type === b.type &&
    Math.abs(a.gain - b.gain) <= tol.gain &&
    Math.abs(a.freq - b.freq) <= tol.freq &&
    Math.abs(a.q - b.q) <= tol.q
  );
}

export function profilesEqual(
  a: EqProfile,
  b: EqProfile,
  tol: { gain: number; freq: number; q: number } = DEFAULT_TOL,
): boolean {
  if (Math.abs(a.preamp - b.preamp) > tol.gain) return false;
  if (a.bands.length !== b.bands.length) return false;
  return a.bands.every((band, i) => {
    const other = b.bands[i];
    return other !== undefined && bandsEqual(band, other, tol);
  });
}
