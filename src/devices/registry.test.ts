import { describe, expect, it } from 'vitest';
import { FIIO_MODELS } from './fiio/models';
import { KTMICRO_MODELS } from './ktmicro/models';
import { WALKPLAY_MODELS } from './walkplay/models';
import { matchFamily } from './registry';

describe('matchFamily', () => {
  it('returns null for unknown 0x31B2 product', () => {
    expect(matchFamily(0x31b2, 0x0001)).toBe(null);
  });

  it('returns ktmicro for the listed 0x0111 profile', () => {
    expect(matchFamily(0x31b2, 0x0111)).toBe('ktmicro');
  });

  it('returns null for unknown 0x2972 product', () => {
    expect(matchFamily(0x2972, 0xffff)).toBe(null);
  });

  it('returns fiio for every listed FiiO model', () => {
    for (const m of FIIO_MODELS) {
      expect(matchFamily(0x2972, m.productId)).toBe('fiio');
    }
  });

  it('returns walkplay for every listed WalkPlay model with a product ID', () => {
    for (const m of WALKPLAY_MODELS) {
      if (m.productId === undefined) continue;
      expect(matchFamily(m.vendorId, m.productId)).toBe('walkplay');
    }
  });

  it('returns ktmicro for every listed KTMicro model', () => {
    for (const m of KTMICRO_MODELS) {
      expect(matchFamily(m.vendorId, m.productId)).toBe('ktmicro');
    }
  });
});
