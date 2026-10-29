export function isWebHidSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as Navigator & { hid?: unknown }).hid;
}

export type HidLike = Pick<
  HIDDevice,
  | 'opened'
  | 'open'
  | 'close'
  | 'sendReport'
  | 'addEventListener'
  | 'removeEventListener'
  | 'collections'
  | 'productName'
  | 'vendorId'
  | 'productId'
>;

export class TransportTimeoutError extends Error {
  constructor(message = 'Device did not reply in time') {
    super(message);
    this.name = 'TransportTimeoutError';
  }
}

export class TransportClosedError extends Error {
  constructor(message = 'Transport closed') {
    super(message);
    this.name = 'TransportClosedError';
  }
}

interface Op {
  run: () => Promise<unknown>;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}

export class HidTransport {
  private readonly reportId: number;
  private readonly minGapMs: number;
  private readonly timeoutMs: number;
  private outputLength: number | null = null;
  private queue: Op[] = [];
  private running = false;
  private closed = false;
  private lastEnd: number | null = null;
  private gapTimer: ReturnType<typeof setTimeout> | undefined;
  private cancelActive: ((e: unknown) => void) | null = null;
  private listeners = new Set<(data: Uint8Array) => void>();
  private taps = new Set<(dir: 'out' | 'in', data: Uint8Array) => void>();

  constructor(
    private readonly device: HidLike,
    opts: { reportId: number; minGapMs?: number; timeoutMs?: number },
  ) {
    this.reportId = opts.reportId;
    this.minGapMs = opts.minGapMs ?? 0;
    this.timeoutMs = opts.timeoutMs ?? 1000;
  }

  private readonly onInputReport = (event: Event) => {
    const e = event as HIDInputReportEvent;
    if (e.reportId !== this.reportId) return;
    const data = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength).slice();
    for (const t of [...this.taps]) t('in', data);
    for (const l of [...this.listeners]) l(data);
  };

  async open(): Promise<void> {
    if (!this.device.opened) await this.device.open();
    this.outputLength = this.findOutputLength();
    this.closed = false;
    this.device.removeEventListener('inputreport', this.onInputReport);
    this.device.addEventListener('inputreport', this.onInputReport);
  }

  private findOutputLength(): number {
    for (const c of this.device.collections) {
      for (const r of c.outputReports ?? []) {
        if (r.reportId === this.reportId) {
          let bits = 0;
          for (const item of r.items ?? []) bits += (item.reportSize ?? 0) * (item.reportCount ?? 0);
          return bits / 8;
        }
      }
    }
    throw new Error(`Output report ${this.reportId} not found on device`);
  }

  subscribe(listener: (data: Uint8Array) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  tap(cb: (dir: 'out' | 'in', data: Uint8Array) => void): () => void {
    this.taps.add(cb);
    return () => void this.taps.delete(cb);
  }

  send(bytes: Uint8Array): Promise<void> {
    return this.enqueue(() => this.doSend(bytes));
  }

  request(bytes: Uint8Array, match: (reply: Uint8Array) => boolean): Promise<Uint8Array> {
    return this.enqueue(
      () =>
        new Promise<Uint8Array>((resolve, reject) => {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const finish = () => {
            clearTimeout(timer);
            this.listeners.delete(listener);
            this.cancelActive = null;
          };
          const listener = (data: Uint8Array) => {
            if (!match(data)) return;
            finish();
            resolve(data);
          };
          this.cancelActive = (e) => {
            finish();
            reject(e);
          };
          this.listeners.add(listener);
          timer = setTimeout(() => {
            finish();
            reject(new TransportTimeoutError());
          }, this.timeoutMs);
          this.doSend(bytes).catch((e) => {
            finish();
            reject(e);
          });
        }),
    );
  }

  private async doSend(bytes: Uint8Array): Promise<void> {
    if (this.outputLength === null) throw new Error('Transport not open');
    if (bytes.length > this.outputLength) {
      throw new Error(`Frame is ${bytes.length} bytes, output report holds ${this.outputLength}`);
    }
    const padded = new Uint8Array(this.outputLength);
    padded.set(bytes);
    for (const t of [...this.taps]) t('out', padded.slice());
    await this.device.sendReport(this.reportId, padded);
  }

  private enqueue<T>(run: () => Promise<T>): Promise<T> {
    if (this.closed) return Promise.reject(new TransportClosedError());
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ run, resolve: resolve as (v: unknown) => void, reject });
      this.pump();
    });
  }

  private pump(): void {
    if (this.running || this.closed) return;
    const op = this.queue.shift();
    if (!op) return;
    this.running = true;
    const start = () => {
      this.gapTimer = undefined;
      this.gapOp = null;
      if (this.closed) return;
      op.run().then(op.resolve, op.reject).finally(() => {
        this.lastEnd = Date.now();
        this.running = false;
        this.pump();
      });
    };
    const wait = this.lastEnd === null ? 0 : this.lastEnd + this.minGapMs - Date.now();
    if (wait > 0) {
      this.gapTimer = setTimeout(start, wait);
      this.gapOp = op;
    } else start();
  }

  private gapOp: Op | null = null;

  async close(): Promise<void> {
    this.closed = true;
    const err = new TransportClosedError();
    clearTimeout(this.gapTimer);
    this.gapTimer = undefined;
    if (this.gapOp) {
      this.gapOp.reject(err);
      this.gapOp = null;
    }
    this.cancelActive?.(err);
    for (const op of this.queue) op.reject(err);
    this.queue = [];
    this.device.removeEventListener('inputreport', this.onInputReport);
    await this.device.close();
  }
}

export function hasOutputReport(device: Pick<HIDDevice, 'collections'>, reportId: number): boolean {
  return device.collections.some((c) => (c.outputReports ?? []).some((r) => r.reportId === reportId));
}

// Chrome returns one HIDDevice per HID interface of the chosen product. The BTR17 command
// collection is on usage page 0x01; filtering on it hides the MQA HID interface in the chooser.
const FIIO_VENDOR_ID = 0x2972;
// WalkPlay vendors (Marigold + scheme 15/16/18 captures). Kept off the FiiO-only chooser.
const WALKPLAY_VENDOR_IDS = [0x35d8, 0x3302];
const KTMICRO_VENDOR_ID = 0x31b2;
export async function requestFiioDevices(): Promise<HIDDevice[]> {
  return navigator.hid.requestDevice({ filters: [{ vendorId: FIIO_VENDOR_ID, usagePage: 0x01 }] });
}

export function connectDeviceFilters(): HIDDeviceFilter[] {
  return [
    { vendorId: FIIO_VENDOR_ID, usagePage: 0x01 },
    ...WALKPLAY_VENDOR_IDS.map((vendorId) => ({ vendorId })),
    { vendorId: KTMICRO_VENDOR_ID },
    // FiiO BTR13 (Qualcomm 0x0A12:0x4007): command collection is on 0xFF00; 0xFFA0 is a second interface.
    { vendorId: 0x0a12, productId: 0x4007, usagePage: 0xff00 },
  ];
}

// Empty filters list every HID device, so testers with unknown vendor IDs (the BTR13 enumerates
// as Qualcomm 0x0A12) can still send a report. Unknown devices only get a descriptor probe.
export function verifyDeviceFilters(): HIDDeviceFilter[] {
  return [];
}

export async function requestConnectDevices(): Promise<HIDDevice[]> {
  return navigator.hid.requestDevice({ filters: connectDeviceFilters() });
}

export async function requestVerifyDevices(): Promise<HIDDevice[]> {
  return navigator.hid.requestDevice({ filters: verifyDeviceFilters() });
}

export interface HidCollectionDescriptor {
  usagePage: number;
  usage: number;
  input: number[];
  output: number[];
  feature: number[];
}

export interface HidDeviceDescriptor {
  productName: string;
  vendorId: number;
  productId: number;
  collections: HidCollectionDescriptor[];
}

export function describeHid(
  device: Pick<HIDDevice, 'productName' | 'vendorId' | 'productId' | 'collections'>,
): HidDeviceDescriptor {
  return {
    productName: device.productName ?? '',
    vendorId: device.vendorId,
    productId: device.productId,
    collections: device.collections.map((c) => ({
      usagePage: c.usagePage ?? 0,
      usage: c.usage ?? 0,
      input: (c.inputReports ?? []).map((r) => r.reportId).filter((id): id is number => id !== undefined),
      output: (c.outputReports ?? []).map((r) => r.reportId).filter((id): id is number => id !== undefined),
      feature: (c.featureReports ?? []).map((r) => r.reportId).filter((id): id is number => id !== undefined),
    })),
  };
}

export async function requestFiioDevicesAnyInterface(): Promise<HIDDevice[]> {
  return navigator.hid.requestDevice({ filters: [{ vendorId: 0x2972 }] });
}

export async function getGrantedFiioDevices(): Promise<HIDDevice[]> {
  const devices = await navigator.hid.getDevices();
  return devices.filter((d) => d.vendorId === 0x2972);
}
