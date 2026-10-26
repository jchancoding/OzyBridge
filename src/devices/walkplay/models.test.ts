import { describe, expect, it } from 'vitest';
import { WALKPLAY_MODELS, WALKPLAY_VENDOR_ID, WALKPLAY_VENDOR_ID_3302, findWalkplayModel } from './models';

describe('walkplay model registry', () => {
  it.each(WALKPLAY_MODELS)('$name is untested with Custom slot 101', (m) => {
    expect(m.untested).toBe(true);
    expect(m.capabilities.slots).toEqual([{ id: 101, label: 'Custom', writable: true }]);
    expect(findWalkplayModel(m.vendorId, m.productId)?.name).toBe(m.name);
  });

  it('MOONDROP Marigold (scheme 10)', () => {
    const m = findWalkplayModel(WALKPLAY_VENDOR_ID, 0x011c)!;
    expect(m.capabilities.maxBands).toBe(8);
    expect(m.capabilities.filterTypes).toEqual(['PK']);
    expect(m.capabilities.gain).toEqual({ min: -10, max: 10 });
  });

  it('ddHiFi DSP Cable (scheme 15, full shelves)', () => {
    const m = findWalkplayModel(WALKPLAY_VENDOR_ID_3302, 0x4357)!;
    expect(m.capabilities.maxBands).toBe(8);
    expect(m.capabilities.filterTypes).toEqual(['LSC', 'PK', 'HSC']);
  });

  it('TANCHJIM-STARGATE II (scheme 15, PK only)', () => {
    const m = findWalkplayModel(WALKPLAY_VENDOR_ID_3302, 0x43d4)!;
    expect(m.capabilities.filterTypes).toEqual(['PK']);
  });

  it('Protocol Max (scheme 16)', () => {
    const m = findWalkplayModel(WALKPLAY_VENDOR_ID_3302, 0x43cc)!;
    expect(m.capabilities.maxBands).toBe(10);
    expect(m.capabilities.filterTypes).toEqual(['LSC', 'PK', 'HSC']);
  });

  it('TANCHJIM-SPACE PRO (scheme 16, PK only)', () => {
    const m = findWalkplayModel(WALKPLAY_VENDOR_ID_3302, 0x4367)!;
    expect(m.capabilities.filterTypes).toEqual(['PK']);
  });

  it('Octave (scheme 18)', () => {
    const m = findWalkplayModel(WALKPLAY_VENDOR_ID_3302, 0x39c3)!;
    expect(m.capabilities.maxBands).toBe(10);
    expect(m.capabilities.filterTypes).toEqual(['LSC', 'PK', 'HSC']);
  });

  it('does not match vendor without product', () => {
    expect(findWalkplayModel(WALKPLAY_VENDOR_ID_3302, 0x011c)).toBeUndefined();
    expect(findWalkplayModel(WALKPLAY_VENDOR_ID, 0x4357)).toBeUndefined();
  });
});
