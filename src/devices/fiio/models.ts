import { hasOutputReport } from '../../transport/webhid';
import type { DeviceCapabilities, EqSlot } from '../types';

export const FIIO_VENDOR_ID = 0x2972;

export interface FiioModel {
  productId: number;
  name: string;
  reportId: number;
  firmwareCmd: boolean;
  untested?: true;
  capabilities: DeviceCapabilities;
}

const builtIn = ['Jazz', 'Pop', 'Rock', 'Dance', 'R&B', 'Classic', 'Hip-hop'];
const btr17Slots: EqSlot[] = [
  ...builtIn.map((label, id) => ({ id, label, writable: false })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: 160 + i, label: `USER${i + 1}`, writable: true })),
];

const defaultFreqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const builtInSlots: EqSlot[] = builtIn.map((label, id) => ({ id, label, writable: false }));
const userSlots = (ids: number[]): EqSlot[] => ids.map((id, i) => ({ id, label: `USER${i + 1}`, writable: true }));

function devicePeqModel(
  productId: number,
  name: string,
  gainMin: number,
  userIds: number[],
  eqOffSlotId: number | null,
): FiioModel {
  return {
    productId,
    name,
    reportId: 7,
    firmwareCmd: false,
    untested: true,
    capabilities: {
      maxBands: 10,
      filterTypes: ['PK', 'LSC', 'HSC'],
      gain: { min: gainMin, max: 12 },
      preamp: { min: gainMin, max: 12 },
      q: { min: 0.25, max: 8 },
      freq: { min: 20, max: 20000 },
      step: { gain: 0.1, q: 0.01, freq: 1 },
      defaultFreqs,
      slots: [...builtInSlots, ...userSlots(userIds)],
      eqOffSlotId,
    },
  };
}

export const FIIO_MODELS: FiioModel[] = [
  {
    productId: 0x0088,
    name: 'FiiO BTR17',
    reportId: 7,
    firmwareCmd: false,
    capabilities: {
      maxBands: 10,
      filterTypes: ['PK', 'LSC', 'HSC'],
      gain: { min: -24, max: 12 },
      preamp: { min: -24, max: 12 },
      q: { min: 0.25, max: 8 },
      freq: { min: 20, max: 20000 },
      step: { gain: 0.1, q: 0.01, freq: 1 },
      defaultFreqs: [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
      slots: btr17Slots,
      eqOffSlotId: 240,
    },
  },
  devicePeqModel(0x0104, 'FiiO KA15', -12, [7, 8, 9], 10),
  devicePeqModel(0x0126, 'SNOWSKY Melody', -12, [160, 161, 162], 240),
];

export function findFiioModel(vendorId: number, productId: number): FiioModel | undefined {
  if (vendorId !== FIIO_VENDOR_ID) return undefined;
  return FIIO_MODELS.find((m) => m.productId === productId);
}

export function pickFiioInterface<T extends Pick<HIDDevice, 'vendorId' | 'productId' | 'collections'>>(
  devices: readonly T[],
): T | null {
  for (const d of devices) {
    const model = findFiioModel(d.vendorId, d.productId);
    if (model && hasOutputReport(d, model.reportId)) return d;
  }
  return null;
}
