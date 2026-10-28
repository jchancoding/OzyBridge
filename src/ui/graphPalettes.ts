import { useEffect, useState } from 'react';

export interface GraphPalette {
  id: string;
  eq: string;
  equalized: string;
  iem: readonly [string, string, string];
  target: readonly [string, string, string, string];
  compare: string;
}

/** Saturated inks. Each set stays apart in hue and reads on that theme's graph surface. */
export const GRAPH_PALETTES: Record<'light' | 'dark', readonly GraphPalette[]> = {
  dark: [
    {
      id: 'signal',
      eq: '#3D8BFF',
      equalized: '#FF4747',
      iem: ['#EB8D00', '#00EB5E', '#DA47FF'],
      target: ['#BCEB00', '#00EBEB', '#9175FF', '#FF2EAB'],
      compare: '#2FEB00',
    },
    {
      id: 'flare',
      eq: '#00BCEB',
      equalized: '#FF4B1F',
      iem: ['#EBBC00', '#00EB8D', '#A970FF'],
      target: ['#8DEB00', '#6685FF', '#F500F5', '#FF3D8B'],
      compare: '#00EB00',
    },
    {
      id: 'volt',
      eq: '#0090F0',
      equalized: '#FF4268',
      iem: ['#F06000', '#00EBBC', '#C061FF'],
      target: ['#EBEB00', '#5EEB00', '#8080FF', '#FF0FCF'],
      compare: '#00EB2F',
    },
  ],
  light: [
    {
      id: 'ink',
      eq: '#176BE8',
      equalized: '#E31616',
      iem: ['#A26810', '#0D873E', '#BE17E8'],
      target: ['#677D0C', '#0D8282', '#4117E8', '#DA168C'],
      compare: '#26870D',
    },
    {
      id: 'press',
      eq: '#1741E8',
      equalized: '#D53C15',
      iem: ['#8B720E', '#0D8253', '#CC14CC'],
      target: ['#507D0C', '#0F7E99', '#6B17E8', '#DF1666'],
      compare: '#0D870D',
    },
    {
      id: 'folio',
      eq: '#1717E8',
      equalized: '#E3163F',
      iem: ['#BE5713', '#0D826B', '#9417E8'],
      target: ['#79790C', '#137ABE', '#D515AF', '#3C820D'],
      compare: '#0D8726',
    },
  ],
};

export function paletteColors(p: GraphPalette): string[] {
  return [p.eq, p.equalized, ...p.iem, ...p.target, p.compare];
}

export function useGraphTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState(readGraphTheme);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    const obs = new MutationObserver(() => setTheme(readGraphTheme()));
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

export function readGraphTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark';
  const set = document.documentElement.dataset.theme;
  if (set === 'light' || set === 'dark') return set;
  if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}
