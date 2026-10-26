import { describe, expect, it } from 'vitest';
import { FRAMES, toRuns } from './mascotFrames';

const diff = (a: string[], b: string[]) => a.reduce((n, row, y) => n + [...row].filter((ch, x) => ch !== b[y]?.[x]).length, 0);

describe('mascot frames', () => {
  it('every frame is 24x24 from the palette', () => {
    for (const f of Object.values(FRAMES)) {
      expect(f).toHaveLength(24);
      for (const row of f) expect(row).toMatch(/^[.12345]{24}$/);
    }
  });
  it('uses at most 5 colours', () => {
    for (const f of Object.values(FRAMES)) expect(new Set(f.join('').replace(/\./g, '')).size).toBeLessThanOrEqual(5);
  });
  it('walk frames stay close to walk1', () => {
    for (const n of ['walk2', 'walk3', 'walk4'] as const) expect(diff(FRAMES.walk1, FRAMES[n])).toBeLessThanOrEqual(40);
  });
  it('toRuns round-trips', () => {
    for (const f of Object.values(FRAMES)) {
      const grid = f.map(() => Array<string>(24).fill('.'));
      for (const r of toRuns(f)) for (let i = 0; i < r.w; i++) grid[r.y]![r.x + i] = r.c;
      expect(grid.map((r) => r.join(''))).toEqual(f);
    }
  });
});
