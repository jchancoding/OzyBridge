import type { EqProfile } from '../../core/eq';
import { HidTransport, TransportTimeoutError, type HidLike } from '../../transport/webhid';
import { ProtocolError, UnsupportedDeviceError, type DeviceAdapter } from '../types';
import { findWalkplayModel } from './models';
import {
  CMD,
  REPORT_ID,
  decodeFirmware,
  decodeGlobalGain,
  decodePeqBand,
  matchReply,
  readFirmware,
  readGlobalGain,
  readPeqBand,
} from './protocol';

export const CUSTOM_SLOT_ID = 101;

export class ReadOnlyDeviceError extends Error {
  constructor(message = 'This device is read-only in OzyBridge') {
    super(message);
    this.name = 'ReadOnlyDeviceError';
  }
}

export interface ConnectOpts {
  hid?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  log?: (dir: 'out' | 'in', bytes: Uint8Array) => void;
}

export async function connectWalkplay(device: HidLike, opts: ConnectOpts = {}): Promise<DeviceAdapter> {
  const model = findWalkplayModel(device.vendorId, device.productId);
  if (!model) {
    throw new UnsupportedDeviceError(
      `Unsupported device ${device.vendorId.toString(16)}:${device.productId.toString(16)}`,
    );
  }
  const caps = model.capabilities;
  const transport = new HidTransport(device, { reportId: REPORT_ID, timeoutMs: 1000 });
  await transport.open();

  const log = opts.log;
  if (log) transport.subscribe((r) => log('in', r));

  const request = async (frame: Uint8Array, cmd: number): Promise<Uint8Array> => {
    log?.('out', frame);
    const raw = await transport.request(frame, (r) => matchReply(r, cmd));
    return raw;
  };

  let firmware: string | null = null;
  try {
    const fw = await request(readFirmware(), CMD.VERSION);
    firmware = decodeFirmware(fw) || null;
  } catch (e) {
    await transport.close().catch(() => {});
    if (!(e instanceof TransportTimeoutError)) throw e;
  }

  let chain: Promise<unknown> = Promise.resolve();
  const locked = <T>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.then(fn);
    chain = p.then(() => {}, () => {});
    return p;
  };

  const readProfile = async (): Promise<EqProfile> => {
    const bands = [];
    for (let i = 0; i < caps.maxBands; i++) {
      const raw = await request(readPeqBand(i), CMD.PEQ_VALUES);
      const band = decodePeqBand(raw);
      if (raw[4] !== i) throw new ProtocolError(`Band reply does not match band ${i}`);
      bands.push(band);
    }
    try {
      const gg = await request(readGlobalGain(), CMD.GLOBAL_GAIN);
      decodeGlobalGain(gg);
    } catch {
      // Global gain is read for parity with devicePEQ pull; not mapped to preamp.
    }
    return { preamp: 0, bands };
  };

  const callbacks = new Set<() => void>();
  let gone = false;
  const hid = opts.hid ?? (typeof navigator !== 'undefined' ? (navigator as { hid?: EventTarget }).hid : undefined);
  const onHidDisconnect = (e: Event) => {
    if ((e as Event & { device?: unknown }).device !== device || gone) return;
    gone = true;
    hid?.removeEventListener('disconnect', onHidDisconnect);
    void transport.close().catch(() => {});
    for (const cb of [...callbacks]) cb();
  };
  hid?.addEventListener('disconnect', onHidDisconnect);

  return {
    info: {
      vendorId: device.vendorId,
      productId: device.productId,
      productName: device.productName || model.name,
      firmware,
    },
    capabilities: caps,

    async disconnect() {
      gone = true;
      hid?.removeEventListener('disconnect', onHidDisconnect);
      await transport.close();
    },

    onDisconnect(cb) {
      callbacks.add(cb);
      return () => void callbacks.delete(cb);
    },

    getActiveSlot: () => locked(async () => CUSTOM_SLOT_ID),
    setActiveSlot: (_id: number) =>
      locked(async () => {
        throw new ReadOnlyDeviceError();
      }),
    readActiveProfile: () => locked(readProfile),
    readSlot: (id) =>
      locked(async () => {
        if (id !== CUSTOM_SLOT_ID) throw new RangeError(`Unknown slot ${id}`);
        return readProfile();
      }),
    writeSlot: (_id: number, _profile: EqProfile) =>
      locked(async () => {
        throw new ReadOnlyDeviceError();
      }),
  };
}
