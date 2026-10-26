// @ts-expect-error no @types/node in this repo; Vitest runs in node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { composite, contrastRatio, readThemes } from './contrast';

// Vitest returns '' for `?raw` CSS imports, so read the file directly.
const themes = readThemes(readFileSync(new URL('./tokens.css', import.meta.url), 'utf8'));

describe('contrast helpers', () => {
  it('computes known ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });
  it('composites alpha over a colour', () => {
    expect(composite('rgb(255 255 255 / 0.5)', '#000000')).toBe('#808080');
  });
});

type Pair = [fg: string, bg: string, min: number];

function pairs(): Pair[] {
  const out: Pair[] = [];
  const text = ['--oz-text', '--oz-text-2', '--oz-text-3', '--oz-accent-strong'];
  for (const t of text)
    for (const b of ['--oz-bg', '--oz-surface', '--oz-surface-2', '--oz-accent-wash']) out.push([t, b, 4.5]);
  for (const b of ['--oz-drop-wash', '--oz-danger-wash', '--oz-warn-wash']) out.push(['--oz-text', b, 4.5]);
  out.push(['--oz-on-danger', '--oz-danger', 4.5], ['--oz-on-ok', '--oz-ok', 4.5], ['--oz-on-accent', '--oz-accent-fill', 4.5]);
  out.push(['--oz-on-inverse', '--oz-inverse', 4.5]);
  out.push(['--oz-danger', '--oz-surface', 4.5], ['--oz-danger', '--oz-danger-wash', 4.5]);
  for (const g of ['--oz-accent', '--oz-curve-2', '--oz-drop', '--oz-danger', '--oz-ok', '--oz-warn', '--oz-line-strong'])
    out.push([g, '--oz-surface', 3]);
  out.push(['--oz-drop', '--oz-drop-wash', 3]);
  return out;
}

describe.each(['light', 'dark'] as const)('%s theme contrast', (name) => {
  const t = themes[name];
  for (const [fg, bg, min] of pairs()) {
    it(`${fg} on ${bg} >= ${min}`, () => {
      expect(t[fg], `${fg} missing`).toBeDefined();
      expect(t[bg], `${bg} missing`).toBeDefined();
      const r = contrastRatio(t[fg]!, t[bg]!);
      expect(r, `${name}: ${fg} on ${bg} is ${r.toFixed(2)}, needs ${min}`).toBeGreaterThanOrEqual(min);
    });
  }
  it('--oz-text-3 on --oz-bg under grid line (35%) >= 4.5', () => {
    const line = t['--oz-line']!;
    const bg = composite(`rgb(${parseInt(line.slice(1, 3), 16)} ${parseInt(line.slice(3, 5), 16)} ${parseInt(line.slice(5, 7), 16)} / 0.35)`, t['--oz-bg']!);
    const r = contrastRatio(t['--oz-text-3']!, bg);
    expect(r, `${name}: text-3 on grid is ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  });
  for (const fg of ['--oz-text', '--oz-text-2', '--oz-text-3']) {
    it(`${fg} on glass over --oz-text >= 4.5`, () => {
      const bg = composite(t['--oz-glass']!, t['--oz-text']!);
      const r = contrastRatio(t[fg]!, bg);
      expect(r, `${name}: ${fg} on glass is ${r.toFixed(2)}, needs 4.5`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
