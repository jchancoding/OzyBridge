import type { EqLimits, EqProfile } from '../core/eq';

export interface EqSlot { id: number; label: string; writable: boolean }
export type DeviceCapabilities = EqLimits & { slots: EqSlot[]; eqOffSlotId: number | null };
export interface DeviceInfo { vendorId: number; productId: number; productName: string; firmware: string | null }

export class UnsupportedDeviceError extends Error {
  constructor(message = 'Unsupported device') {
    super(message);
    this.name = 'UnsupportedDeviceError';
  }
}

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolError';
  }
}

export class WriteVerifyError extends Error {
  constructor(public readonly expected: EqProfile, public readonly readBack: EqProfile) {
    super('Device read-back does not match what was written');
    this.name = 'WriteVerifyError';
  }
}

export interface DeviceAdapter {
  readonly info: DeviceInfo;
  readonly capabilities: DeviceCapabilities;
  disconnect(): Promise<void>;
  onDisconnect(cb: () => void): () => void;   // returns unsubscribe
  getActiveSlot(): Promise<number>;
  setActiveSlot(id: number): Promise<void>;
  readActiveProfile(): Promise<EqProfile>;
  // Switches to the slot, reads it, then restores the previously active slot, even on failure.
  readSlot(id: number): Promise<EqProfile>;
  writeSlot(id: number, profile: EqProfile): Promise<EqProfile>;  // resolves with the read-back profile
}
