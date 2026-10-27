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
  /** Exact product ID. When absent, the model matches by `productName` instead. */
  productId?: number;
  /** USB product name, matched case-insensitively. Moondrop shares one vendor ID across models. */
  productName?: string;
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
  // Moondrop models listed by name in the Moondrop tool and devicePEQ. Same 0x4B band read as the Marigold.
  // USB product IDs are unknown, so these match by product name. Read-only.
  ...(
    [
      ['DAWN PRO2', ['LSC', 'PK', 'HSC']],
      ['FreeDSP Pro', ['LSC', 'PK', 'HSC']],
      ['FreeDSP Mini', ['LSC', 'PK', 'HSC']],
      ['MOONRIVER 3', ['LSC', 'PK', 'HSC']],
      ['DHA15', ['LSC', 'PK', 'HSC']],
      ['Deco Audio System', ['LSC', 'PK', 'HSC']],
      ['INN Deco75-DH Audio', ['LSC', 'PK', 'HSC']],
      ['Rays', ['PK']],
      ['AG Rays', ['PK']],
      ['Echo A', ['PK']],
    ] as [string, FilterType[]][]
  ).map(([productName, types]): WalkplayModel => ({
    vendorId: WALKPLAY_VENDOR_ID,
    productName,
    name: `MOONDROP ${productName}`,
    untested: true,
    capabilities: { ...caps(8, types, { min: -12, max: 12 }), q: { min: 0.25, max: 8 } },
  })),
];

const norm = (s: string) => s.trim().toLowerCase();

export function findWalkplayModel(vendorId: number, productId: number, productName = ''): WalkplayModel | undefined {
  const byId = WALKPLAY_MODELS.find((m) => m.vendorId === vendorId && m.productId === productId);
  if (byId) return byId;
  const name = norm(productName).replace(/^moondrop\s+/, '');
  if (!name) return undefined;
  return WALKPLAY_MODELS.find(
    (m) => m.vendorId === vendorId && m.productId === undefined && m.productName !== undefined && norm(m.productName) === name,
  );
}

export function pickWalkplayInterface(devices: HIDDevice[]): HIDDevice | null {
  for (const d of devices) {
    if (findWalkplayModel(d.vendorId, d.productId, d.productName) && hasOutputReport(d, REPORT_ID)) return d;
  }
  return null;
}
