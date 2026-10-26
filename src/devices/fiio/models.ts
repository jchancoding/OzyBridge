import type { DeviceCapabilities, EqSlot } from '../types';

export const FIIO_VENDOR_ID = 0x2972;

export interface FiioModel {
  productId: number;
  name: string;
  reportId: number;
  capabilities: DeviceCapabilities;
}

const builtIn = ['Jazz', 'Pop', 'Rock', 'Dance', 'R&B', 'Classic', 'Hip-hop'];
const btr17Slots: EqSlot[] = [
  ...builtIn.map((label, id) => ({ id, label, writable: false })),
  ...Array.from({ length: 10 }, (_, i) => ({ id: 160 + i, label: `USER${i + 1}`, writable: true })),
];

export const FIIO_MODELS: FiioModel[] = [
  {
    productId: 0x0088,
    name: 'FiiO BTR17',
    reportId: 7,
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
];

export function findFiioModel(vendorId: number, productId: number): FiioModel | undefined {
  if (vendorId !== FIIO_VENDOR_ID) return undefined;
  return FIIO_MODELS.find((m) => m.productId === productId);
}
