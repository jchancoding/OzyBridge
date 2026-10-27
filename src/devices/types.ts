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

// BTR17 with EQ switched off in the device settings: it still answers slot and count gets
// but never answers band reads (bench 2026-10-27).
export class EqDisabledError extends Error {
  constructor() {
    super('The device is not answering EQ reads. EQ is probably switched off on the device.');
    this.name = 'EqDisabledError';
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
  // Optional batch read: reads each slot, reports it as it lands, restores the active slot once at the end.
  readSlots?(ids: number[], onSlot: (id: number, profile: EqProfile) => void): Promise<void>;
  writeSlot(id: number, profile: EqProfile): Promise<EqProfile>;  // resolves with the read-back profile
}
