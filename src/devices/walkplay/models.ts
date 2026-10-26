import { hasOutputReport } from '../../transport/webhid';
import type { DeviceCapabilities, EqSlot } from '../types';
import { REPORT_ID } from './protocol';

export const WALKPLAY_VENDOR_ID = 0x35d8;

export interface WalkplayModel {
  productId: number;
  name: string;
  untested?: true;
  capabilities: DeviceCapabilities;
}

const marigoldSlots: EqSlot[] = [{ id: 101, label: 'Custom', writable: true }];

export const WALKPLAY_MODELS: WalkplayModel[] = [
  {
    productId: 0x011c,
    name: 'MOONDROP Marigold',
    untested: true,
    capabilities: {
      maxBands: 8,
      filterTypes: ['PK'],
      gain: { min: -10, max: 10 },
      preamp: { min: 0, max: 0 },
      q: { min: 0.25, max: 8 },
      freq: { min: 20, max: 20000 },
      step: { gain: 0.1, q: 0.01, freq: 1 },
      slots: marigoldSlots,
      eqOffSlotId: null,
    },
  },
];

export function findWalkplayModel(vendorId: number, productId: number): WalkplayModel | undefined {
  if (vendorId !== WALKPLAY_VENDOR_ID) return undefined;
  return WALKPLAY_MODELS.find((m) => m.productId === productId);
}

export function pickWalkplayInterface(devices: HIDDevice[]): HIDDevice | null {
  for (const d of devices) {
    if (findWalkplayModel(d.vendorId, d.productId) && hasOutputReport(d, REPORT_ID)) return d;
  }
  return null;
}
