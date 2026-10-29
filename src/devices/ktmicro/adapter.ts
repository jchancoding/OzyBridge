import type { EqProfile } from '../../core/eq';
import { HidTransport, type HidLike } from '../../transport/webhid';
import { UnsupportedDeviceError, type DeviceAdapter } from '../types';
import { ReadOnlyDeviceError } from '../walkplay/adapter';
import { findKtmicroModel } from './models';
import {
  REPORT_ID,
  assertAllowedOutbound,
  bandRegisterPair,
  decodeBand,
  decodeDigitalGainByte,
  matchReply,
  readBandGainFreq,
  readBandQType,
  readDigitalGain,
} from './protocol';

export const CUSTOM_SLOT_ID = 101;

export interface ConnectOpts {
  hid?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  log?: (dir: 'out' | 'in', bytes: Uint8Array) => void;
}

export async function connectKtmicro(device: HidLike, opts: ConnectOpts = {}): Promise<DeviceAdapter> {
  const model = findKtmicroModel(device.vendorId, device.productId);
  if (!model) {
    throw new UnsupportedDeviceError(
      `Unsupported device ${device.vendorId.toString(16)}:${device.productId.toString(16)}`,
    );
  }
  const caps = model.capabilities;
  const bandMap = model;
  const halfFreq = model.halfFreq ?? false;
  const transport = new HidTransport(device, { reportId: REPORT_ID, timeoutMs: 1000 });
  await transport.open();

  const log = opts.log;
  const frameLog: { dir: 'out' | 'in'; hex: string }[] = [];
  const frameHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ').toUpperCase();
  const pushFrame = (dir: 'out' | 'in', data: Uint8Array) => {
    log?.(dir, data);
    frameLog.push({ dir, hex: frameHex(data) });
    if (frameLog.length > 200) frameLog.splice(0, frameLog.length - 200);
  };
  transport.tap((dir, data) => {
    pushFrame(dir, data);
  });

  const request = async (frame: Uint8Array, reg: number): Promise<Uint8Array> => {
    assertAllowedOutbound(frame);
    return transport.request(frame, (r) => matchReply(r, reg));
  };

  let chain: Promise<unknown> = Promise.resolve();
  const locked = <T>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.then(fn);
    chain = p.then(() => {}, () => {});
    return p;
  };

  const readProfile = async (): Promise<EqProfile> => {
    const bands = [];
    for (let i = 0; i < caps.maxBands; i++) {
      const { gainFreq, q } = bandRegisterPair(bandMap, i);
      const gf = await request(readBandGainFreq(i, bandMap), gainFreq);
      const qt = await request(readBandQType(i, bandMap), q);
      bands.push(decodeBand(gf, qt, halfFreq));
    }
    try {
      const dg = await request(readDigitalGain(), 0x66);
      decodeDigitalGainByte(dg);
    } catch {
      // Read for parity with devicePEQ pull; not mapped to preamp on this profile.
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
      firmware: null,
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

    rawFrames() {
      const out = frameLog.slice();
      frameLog.length = 0;
      return out;
    },
  };
}
