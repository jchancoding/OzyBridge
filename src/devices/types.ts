import type { EqProfile, FilterType, Range } from '../core/eq';

export interface EqSlot { id: number; label: string; writable: boolean }
export interface DeviceCapabilities {
  maxBands: number; filterTypes: FilterType[];
  gain: Range; preamp: Range; q: Range; freq: Range;
  slots: EqSlot[]; eqOffSlotId: number | null;
}
export interface DeviceInfo { vendorId: number; productId: number; productName: string; firmware: string | null }
export interface DeviceAdapter {
  readonly info: DeviceInfo;
  readonly capabilities: DeviceCapabilities;
  disconnect(): Promise<void>;
  onDisconnect(cb: () => void): () => void;   // returns unsubscribe
  getActiveSlot(): Promise<number>;
  setActiveSlot(id: number): Promise<void>;
  readActiveProfile(): Promise<EqProfile>;
  writeSlot(id: number, profile: EqProfile): Promise<EqProfile>;  // resolves with the read-back profile
}
