export type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const h = hex.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function toHex(rgb: number[]): string {
  return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const a = luminance(hexA);
  const b = luminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** `rgbaTop` like `rgb(22 29 38 / 0.92)`. */
export function composite(rgbaTop: string, hexUnder: string): string {
  const m = rgbaTop.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+))?\s*\)/);
  if (!m) throw new Error(`Cannot parse colour: ${rgbaTop}`);
  const top = [m[1]!, m[2]!, m[3]!].map(Number);
  const alpha = m[4] === undefined ? 1 : Number(m[4]);
  const under = parseHex(hexUnder);
  return toHex(top.map((v, i) => v * alpha + under[i]! * (1 - alpha)));
}

function readBlock(css: string, selector: RegExp): Record<string, string> {
  const m = css.match(selector);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const d of m[1]!.matchAll(/(--oz-[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]!] = d[2]!.trim();
  return out;
}

export function readThemes(css: string): { light: Record<string, string>; dark: Record<string, string> } {
  const light = readBlock(css, /:root\s*\{([^}]*)\}/);
  const dark = readBlock(css, /:root\[data-theme='dark'\]\s*\{([^}]*)\}/);
  return { light, dark: { ...light, ...dark } };
}
