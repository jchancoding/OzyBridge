import { describe, expect, it } from 'vitest';
import { KTMICRO_MODELS, KTMICRO_VENDOR_ID, findKtmicroModel } from './models';

describe('ktmicro model registry', () => {
  it.each(KTMICRO_MODELS)('$name is untested with Custom slot 101', (m) => {
    expect(m.untested).toBe(true);
    expect(m.capabilities.slots).toEqual([{ id: 101, label: 'Custom', writable: true }]);
    expect(findKtmicroModel(m.vendorId, m.productId)?.name).toBe(m.name);
  });

  it('0x0111 profile capabilities', () => {
    const m = findKtmicroModel(KTMICRO_VENDOR_ID, 0x0111)!;
    expect(m.capabilities.maxBands).toBe(5);
    expect(m.capabilities.filterTypes).toEqual(['LSC', 'PK', 'HSC']);
    expect(m.capabilities.gain).toEqual({ min: -12, max: 12 });
    expect(m.halfFreq).toBe(false);
  });

  it('does not match other product IDs', () => {
    expect(findKtmicroModel(KTMICRO_VENDOR_ID, 0x0113)).toBeUndefined();
    expect(findKtmicroModel(KTMICRO_VENDOR_ID, 0x1112)).toBeUndefined();
  });
});
