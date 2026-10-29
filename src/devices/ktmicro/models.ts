import type { FilterType } from '../../core/eq';
import { hasOutputReport } from '../../transport/webhid';
import type { DeviceCapabilities, EqSlot } from '../types';
import type { BandRegisterMap } from './protocol';
import { REPORT_ID } from './protocol';

export const KTMICRO_VENDOR_ID = 0x31b2;

export interface KtmicroModel extends BandRegisterMap {
  vendorId: number;
  productId: number;
  /** Landing-page label; connected UI uses USB `productName`. */
  name: string;
  untested?: true;
  /** When true, frequency on the wire is half the displayed Hz (devicePEQ `compensate2X`). */
  halfFreq?: boolean;
  capabilities: DeviceCapabilities;
}

const customSlot: EqSlot[] = [{ id: 101, label: 'Custom', writable: true }];

const ktmicroQ = { min: 0.1, max: 10 };
const ktmicroFreq = { min: 20, max: 20000 };
const ktmicroStep = { gain: 0.1, q: 0.01, freq: 1 };

function caps(filterTypes: FilterType[]): DeviceCapabilities {
  return {
    maxBands: 5,
    filterTypes,
    gain: { min: -12, max: 12 },
    preamp: { min: 0, max: 0 },
    q: ktmicroQ,
    freq: ktmicroFreq,
    step: ktmicroStep,
    slots: customSlot,
    eqOffSlotId: null,
  };
}

export const KTMICRO_MODELS: KtmicroModel[] = [
  {
    vendorId: KTMICRO_VENDOR_ID,
    productId: 0x0111,
    name: 'KTMicro USB DSP (0x0111 profile)',
    untested: true,
    halfFreq: false,
    baseRegisterOffset: 0x26,
    capabilities: caps(['LSC', 'PK', 'HSC']),
  },
];

export function findKtmicroModel(vendorId: number, productId: number): KtmicroModel | undefined {
  return KTMICRO_MODELS.find((m) => m.vendorId === vendorId && m.productId === productId);
}

export function pickKtmicroInterface(devices: HIDDevice[]): HIDDevice | null {
  for (const d of devices) {
    if (findKtmicroModel(d.vendorId, d.productId) && hasOutputReport(d, REPORT_ID)) return d;
  }
  return null;
}
