// @ts-expect-error no @types/node in this repo; Vitest runs in node
import { readFileSync } from 'node:fs';
// @ts-expect-error no @types/node in this repo; Vitest runs in node
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMeasurement } from './measurement';
import { TARGETS, targetCurve, targetUrl } from './targets';

describe('TARGETS', () => {
  it('has unique ids', () => {
    const ids = TARGETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds targetUrl with encoded path', () => {
    expect(targetUrl('/OzyBridge/', TARGETS[0] as (typeof TARGETS)[0])).toBe(
      '/OzyBridge/targets/Harman%20IE%202019.txt',
    );
  });
});

describe('bundled target files', () => {
  it.each(TARGETS)('$id parses and normalizes to 0 dB at 1 kHz', (t) => {
    // @ts-expect-error no @types/node in this repo; Vitest runs in node
    const path = join(process.cwd(), 'public/targets', t.file);
    const text = readFileSync(path, 'utf8');
    const m = parseMeasurement(text);
    expect(m.f[0] as number).toBeLessThanOrEqual(21);
    expect(m.f[m.f.length - 1] as number).toBeGreaterThanOrEqual(19500);
    const at1k = targetCurve(m, [1000])[0] as number;
    expect(at1k).toBeCloseTo(0, 9);
  });
});
