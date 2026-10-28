import type { Measurement } from './measurement';
import { normalizeAt, resampleLog } from './measurement';

export interface TargetCurve {
  id: string;
  name: string;
  file: string;
}

export const TARGETS: TargetCurve[] = [
  { id: 'harman-ie-2019', name: 'Harman IE 2019', file: 'Harman IE 2019.txt' },
  { id: 'harman-moa-2025', name: 'Harman MoA 2025', file: 'Harman MoA 2025.txt' },
  { id: 'jm1-10db', name: 'JM-1 (10 dB tilt)', file: 'JM-1 10dB Tilt.txt' },
  { id: 'peqdb-diamond', name: 'PEQdB Diamond', file: 'PEQdB Diamond.txt' },
];

export function targetUrl(base: string, t: TargetCurve): string {
  return `${base}targets/${encodeURIComponent(t.file)}`;
}

export function targetCurve(m: Measurement, freqs: number[]): number[] {
  const resampled = resampleLog(m, freqs);
  return normalizeAt(resampled, freqs, 1000);
}
