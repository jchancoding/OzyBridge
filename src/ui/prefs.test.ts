import { describe, expect, it } from 'vitest';
import { parseThemePref, resolveTheme } from './prefs';

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
