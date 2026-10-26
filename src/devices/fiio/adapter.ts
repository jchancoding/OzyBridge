import { profilesEqual, type EqProfile } from '../../core/eq';
import { HidTransport, TransportTimeoutError, type HidLike } from '../../transport/webhid';
import {
  ProtocolError,
  UnsupportedDeviceError,
  WriteVerifyError,
  type DeviceAdapter,
} from '../types';
import { findFiioModel } from './models';
import {
  CMD,
  buildFrame,
  createSequence,
  decodeBandPayload,
  decodeGain,
  encodeGain,
  parseReply,
  setBand,
} from './protocol';

export interface FiioTiming { bandGapMs: number; afterPreampMs: number }
export const DEFAULT_FIIO_TIMING: FiioTiming = { bandGapMs: 100, afterPreampMs: 2000 };

export interface ConnectOpts {
  timing?: Partial<FiioTiming>;
  hid?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  log?: (dir: 'out' | 'in', bytes: Uint8Array) => void;
}

export type FiioAdapter = DeviceAdapter & { readonly crcMismatches: number };

const NONE = new Uint8Array(0);
const sleep = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

export async function connectFiio(device: HidLike, opts: ConnectOpts = {}): Promise<FiioAdapter> {
  const model = findFiioModel(device.vendorId, device.productId);
  if (!model) {
    throw new UnsupportedDeviceError(
      `Unsupported device ${device.vendorId.toString(16)}:${device.productId.toString(16)}`,
    );
  }
  const caps = model.capabilities;
  const timing = { ...DEFAULT_FIIO_TIMING, ...opts.timing };
  const transport = new HidTransport(device, { reportId: model.reportId, timeoutMs: 1000 });
  await transport.open();

  const nextSeq = createSequence();
  let crcMismatches = 0;
  const log = opts.log;

  const request = async (
    kind: 'get' | 'set',
    cmd: number,
    payload: Uint8Array = NONE,
  ): Promise<Uint8Array> => {
    const frame = buildFrame(kind, cmd, payload, nextSeq());
    log?.('out', frame);
    const raw = await transport.request(frame, (r) => parseReply(r)?.cmd === cmd);
    const reply = parseReply(raw)!;
    log?.('in', raw);
    if (!reply.crcOk) crcMismatches++;
    return reply.payload;
  };

  let firmware: string | null = null;
  try {
    const count = (await request('get', CMD.PEQ_COUNT))[0];
    if (count !== caps.maxBands) {
      throw new ProtocolError(`Device reports ${count} bands, expected ${caps.maxBands}`);
    }
    try {
      const fw = await request('get', CMD.FIRMWARE_VERSION);
      const printable = fw.length > 0 && fw.every((b) => b >= 0x20 && b <= 0x7e);
      firmware = printable ? String.fromCharCode(...fw) : [...fw].join('.');
    } catch (e) {
      if (!(e instanceof TransportTimeoutError)) throw e;
    }
  } catch (e) {
    await transport.close().catch(() => {});
    throw e;
  }

  let chain: Promise<unknown> = Promise.resolve();
  const locked = <T>(fn: () => Promise<T>): Promise<T> => {
    const p = chain.then(fn);
    chain = p.then(() => {}, () => {});
    return p;
  };

  const getActive = async () => {
    const p = await request('get', CMD.PEQ_PRE);
    return p[0] ?? 0;
  };

  const isKnownSlot = (id: number) => caps.slots.some((s) => s.id === id) || id === caps.eqOffSlotId;

  const setActive = async (id: number) => {
    if (!isKnownSlot(id)) throw new RangeError(`Unknown slot ${id}`);
    await request('set', CMD.PEQ_PRE, Uint8Array.of(id));
    const now = await getActive();
    if (now !== id) throw new ProtocolError(`Slot switch failed: asked for ${id}, device is on ${now}`);
  };

  const readProfile = async (): Promise<EqProfile> => {
    const bands = [];
    for (let i = 0; i < caps.maxBands; i++) {
      const p = await request('get', CMD.PEQ_PARAMS, Uint8Array.of(i));
      if (p.length !== 8 || p[0] !== i) throw new ProtocolError(`Band reply does not match band ${i}`);
      bands.push(decodeBandPayload(p).band);
    }
    const g = await request('get', CMD.GLOBAL_GAIN);
    if (g.length < 2) throw new ProtocolError('Short preamp reply');
    return { preamp: decodeGain(g[0]!, g[1]!), bands };
  };

  const inRange = (v: number, r: { min: number; max: number }) =>
    Number.isFinite(v) && v >= r.min && v <= r.max;

  const guard = (id: number, profile: EqProfile) => {
    const slot = caps.slots.find((s) => s.id === id);
    if (!slot || !slot.writable) throw new RangeError(`Slot ${id} is not writable`);
    if (profile.bands.length !== caps.maxBands) {
      throw new RangeError(`Profile needs exactly ${caps.maxBands} bands, got ${profile.bands.length}`);
    }
    if (!inRange(profile.preamp, caps.preamp)) throw new RangeError(`Preamp ${profile.preamp} out of range`);
    profile.bands.forEach((b, i) => {
      if (!caps.filterTypes.includes(b.type)) throw new RangeError(`Band ${i + 1}: filter type ${b.type} not supported`);
      if (!inRange(b.freq, caps.freq)) throw new RangeError(`Band ${i + 1}: frequency ${b.freq} out of range`);
      if (!inRange(b.q, caps.q)) throw new RangeError(`Band ${i + 1}: Q ${b.q} out of range`);
      if (b.enabled && !inRange(b.gain, caps.gain)) throw new RangeError(`Band ${i + 1}: gain ${b.gain} out of range`);
    });
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
    get crcMismatches() {
      return crcMismatches;
    },

    async disconnect() {
      gone = true;
      hid?.removeEventListener('disconnect', onHidDisconnect);
      await transport.close();
    },

    onDisconnect(cb) {
      callbacks.add(cb);
      return () => void callbacks.delete(cb);
    },

    getActiveSlot: () => locked(getActive),
    setActiveSlot: (id) => locked(() => setActive(id)),
    readActiveProfile: () => locked(readProfile),

    readSlot: (id) =>
      locked(async () => {
        const prev = await getActive();
        let result: EqProfile;
        try {
          await setActive(id);
          result = await readProfile();
        } catch (e) {
          await setActive(prev).catch(() => {});
          throw e;
        }
        await setActive(prev);
        return result;
      }),

    writeSlot: (id, profile) =>
      locked(async () => {
        guard(id, profile);
        await setActive(id);
        for (let i = 0; i < profile.bands.length; i++) {
          const frame = setBand(i, profile.bands[i]!, nextSeq());
          log?.('out', frame);
          await transport.send(frame);
          await sleep(timing.bandGapMs);
        }
        await request('set', CMD.GLOBAL_GAIN, encodeGain(profile.preamp));
        await sleep(timing.afterPreampMs);
        await request('set', CMD.PEQ_SAVE, Uint8Array.of(id));
        const readBack = await readProfile();
        if (!profilesEqual(readBack, profile)) throw new WriteVerifyError(profile, readBack);
        return readBack;
      }),
  };
}
