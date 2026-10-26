import { useCallback, useEffect, useState } from 'react';

export const THEME_KEY = 'ozy-theme';
export type ThemePref = 'system' | 'light' | 'dark';

export function parseThemePref(raw: string | null): ThemePref {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

export function resolveTheme(pref: ThemePref, prefersDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return prefersDark ? 'dark' : 'light';
  return pref;
}

export const MOTION_KEY = 'ozy-motion';
export type MotionPref = 'on' | 'off';

export function parseMotionPref(raw: string | null, prefersReduced: boolean): MotionPref {
  if (raw === 'on' || raw === 'off') return raw;
  return prefersReduced ? 'off' : 'on';
}

export function useMotionPref(): [MotionPref, (pref: MotionPref) => void] {
  const [pref, setPrefState] = useState<MotionPref>(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(MOTION_KEY);
    } catch {
      /* storage unavailable */
    }
    return parseMotionPref(raw, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  });

  useEffect(() => {
    document.documentElement.dataset.motion = pref;
  }, [pref]);

  const setPref = useCallback((next: MotionPref) => {
    try {
      localStorage.setItem(MOTION_KEY, next);
    } catch {
      /* choice lasts for this session only */
    }
    setPrefState(next);
  }, []);

  return [pref, setPref];
}

function readPref(): ThemePref {
  try {
    return parseThemePref(localStorage.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPrefState] = useState<ThemePref>(readPref);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(pref, mq.matches);
    };
    apply();
    if (pref !== 'system') return;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);

  const setPref = useCallback((next: ThemePref) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable: choice lasts for this session only */
    }
    setPrefState(next);
  }, []);

  return [pref, setPref];
}
