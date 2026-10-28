import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { GRAPH_PALETTES, paletteColors } from './graphPalettes';

const SURFACE = { light: '#FFFFFF', dark: '#161D26' } as const;

function hue(hex: string): number {
  const h = hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r!, g!, b!);
  const min = Math.min(r!, g!, b!);
  const d = max - min;
  if (d === 0) return 0;
  let H = 0;
  if (max === r) H = ((g! - b!) / d) % 6;
  else if (max === g) H = (b! - r!) / d + 2;
  else H = (r! - g!) / d + 4;
  return (H * 60 + 360) % 360;
}

function hueGap(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d);
}

describe('graph palettes', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`${theme} palettes stay apart and readable on the graph`, () => {
      expect(GRAPH_PALETTES[theme].length).toBeGreaterThanOrEqual(3);
      for (const palette of GRAPH_PALETTES[theme]) {
        const colors = paletteColors(palette);
        expect(new Set(colors).size).toBe(colors.length);
        for (const color of colors) {
          const ratio = contrastRatio(color, SURFACE[theme]);
          expect(ratio, `${palette.id} ${color} on ${theme}`).toBeGreaterThanOrEqual(4.5);
        }
        for (let i = 0; i < colors.length; i++) {
          for (let j = i + 1; j < colors.length; j++) {
            expect(hueGap(colors[i]!, colors[j]!), `${palette.id} ${colors[i]} vs ${colors[j]}`).toBeGreaterThanOrEqual(18);
          }
        }
      }
    });
  }
});
