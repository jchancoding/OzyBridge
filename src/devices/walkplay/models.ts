import type { FilterType } from '../../core/eq';
import { hasOutputReport } from '../../transport/webhid';
import type { DeviceCapabilities, EqSlot } from '../types';
import { REPORT_ID } from './protocol';

/** Moondrop Marigold (scheme 10). */
export const WALKPLAY_VENDOR_ID = 0x35d8;
/** Shared by scheme 15 / 16 / 18 captures (devicePEQ WalkPlay vendor list). */
export const WALKPLAY_VENDOR_ID_3302 = 0x3302;

export const WALKPLAY_VENDOR_IDS = [WALKPLAY_VENDOR_ID, WALKPLAY_VENDOR_ID_3302] as const;

export interface WalkplayModel {
  vendorId: number;
  productId: number;
  name: string;
  untested?: true;
  capabilities: DeviceCapabilities;
}

const customSlot: EqSlot[] = [{ id: 101, label: 'Custom', writable: true }];

const walkplayQ = { min: 0.1, max: 10 };
const walkplayFreq = { min: 20, max: 20000 };
const walkplayStep = { gain: 0.1, q: 0.01, freq: 1 };

function caps(
  maxBands: number,
  filterTypes: FilterType[],
  gain: { min: number; max: number },
): DeviceCapabilities {
  return {
    maxBands,
    filterTypes,
    gain,
    preamp: { min: 0, max: 0 },
    q: walkplayQ,
    freq: walkplayFreq,
    step: walkplayStep,
    slots: customSlot,
    eqOffSlotId: null,
  };
}

export const WALKPLAY_MODELS: WalkplayModel[] = [
  {
    vendorId: WALKPLAY_VENDOR_ID,
    productId: 0x011c,
    name: 'MOONDROP Marigold',
    untested: true,
    capabilities: {
      ...caps(8, ['PK'], { min: -10, max: 10 }),
      q: { min: 0.25, max: 8 },
    },
  },
  {
    vendorId: WALKPLAY_VENDOR_ID_3302,
    productId: 0x4357,
    name: 'ddHiFi DSP Cable - Memory',
    untested: true,
    capabilities: caps(8, ['LSC', 'PK', 'HSC'], { min: -10, max: 10 }),
  },
  {
    vendorId: WALKPLAY_VENDOR_ID_3302,
    productId: 0x43d4,
    name: 'TANCHJIM-STARGATE II',
    untested: true,
    capabilities: caps(8, ['PK'], { min: -10, max: 10 }),
  },
  {
    vendorId: WALKPLAY_VENDOR_ID_3302,
    productId: 0x43cc,
    name: 'CrinEar Protocol Max',
    untested: true,
    capabilities: caps(10, ['LSC', 'PK', 'HSC'], { min: -10, max: 10 }),
  },
  {
    vendorId: WALKPLAY_VENDOR_ID_3302,
    productId: 0x43e6,
    name: 'EPZ TP35 Pro',
    untested: true,
    capabilities: caps(10, ['LSC', 'PK', 'HSC'], { min: -10, max: 10 }),
  },
  {
    vendorId: WALKPLAY_VENDOR_ID_3302,
    productId: 0x4367,
    name: 'TANCHJIM-SPACE PRO',
    untested: true,
    capabilities: caps(10, ['PK'], { min: -10, max: 10 }),
  },
  {
    vendorId: WALKPLAY_VENDOR_ID_3302,
    productId: 0x39c3,
    name: 'NiceHCK Octave',
    untested: true,
    capabilities: caps(10, ['LSC', 'PK', 'HSC'], { min: -10, max: 10 }),
  },
];

export function findWalkplayModel(vendorId: number, productId: number): WalkplayModel | undefined {
  return WALKPLAY_MODELS.find((m) => m.vendorId === vendorId && m.productId === productId);
}

export function pickWalkplayInterface(devices: HIDDevice[]): HIDDevice | null {
  for (const d of devices) {
    if (findWalkplayModel(d.vendorId, d.productId) && hasOutputReport(d, REPORT_ID)) return d;
  }
  return null;
}
