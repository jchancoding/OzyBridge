import { describe, expect, it } from 'vitest';
import { parseMotionPref, parseThemePref, resolveTheme } from './prefs';

describe('theme prefs', () => {
  it('parses known values and defaults to system', () => {
    expect(parseThemePref('light')).toBe('light');
    expect(parseThemePref('dark')).toBe('dark');
    expect(parseThemePref('system')).toBe('system');
    expect(parseThemePref(null)).toBe('system');
    expect(parseThemePref('neon')).toBe('system');
  });
  it('resolves system via OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('motion pref', () => {
  it('defaults on unless reduced motion is requested', () => {
    expect(parseMotionPref(null, false)).toBe('on');
    expect(parseMotionPref(null, true)).toBe('off');
    expect(parseMotionPref('junk', false)).toBe('on');
  });
  it('stored choice wins', () => {
    expect(parseMotionPref('on', true)).toBe('on');
    expect(parseMotionPref('off', false)).toBe('off');
  });
});
