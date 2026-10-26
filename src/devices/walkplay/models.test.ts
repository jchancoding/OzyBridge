import { describe, expect, it } from 'vitest';
import { WALKPLAY_VENDOR_ID, findWalkplayModel } from './models';

describe('MOONDROP Marigold', () => {
  const m = findWalkplayModel(WALKPLAY_VENDOR_ID, 0x011c)!;

  it('is registered as untested', () => {
    expect(m.name).toBe('MOONDROP Marigold');
    expect(m.untested).toBe(true);
  });

  it('has one writable Custom slot', () => {
    expect(m.capabilities.slots).toEqual([{ id: 101, label: 'Custom', writable: true }]);
    expect(m.capabilities.maxBands).toBe(8);
    expect(m.capabilities.filterTypes).toEqual(['PK']);
    expect(m.capabilities.gain).toEqual({ min: -10, max: 10 });
    expect(m.capabilities.preamp).toEqual({ min: 0, max: 0 });
  });
});
