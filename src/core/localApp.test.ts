import { describe, expect, it } from 'vitest';
import { isLocalAppHost } from './localApp';

describe('isLocalAppHost', () => {
  it('is true in Vite dev regardless of hostname', () => {
    expect(isLocalAppHost('jchancoding.github.io', true)).toBe(true);
  });

  it('is true on loopback hostnames when not in dev', () => {
    expect(isLocalAppHost('localhost', false)).toBe(true);
    expect(isLocalAppHost('127.0.0.1', false)).toBe(true);
    expect(isLocalAppHost('[::1]', false)).toBe(true);
  });

  it('is false on the public site hostname', () => {
    expect(isLocalAppHost('jchancoding.github.io', false)).toBe(false);
  });
});
