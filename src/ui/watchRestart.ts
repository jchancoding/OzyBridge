import type { DeviceAdapter } from '../devices/types';

export interface WatchRestartResult {
  restarted: boolean;
  error: unknown | null;
}

export type WatchRestartOpts = {
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function watchRestart(
  adapter: DeviceAdapter,
  work: () => Promise<void>,
  opts: WatchRestartOpts = {},
): Promise<WatchRestartResult> {
  let disconnected = false;
  const off = adapter.onDisconnect(() => {
    disconnected = true;
  });
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? Date.now;
  let error: unknown | null = null;
  try {
    try {
      await work();
    } catch (e) {
      error = e;
    }
    if (disconnected) return { restarted: true, error };
    const deadline = now() + 5000;
    while (now() < deadline) {
      if (disconnected) return { restarted: true, error };
      await sleep(50);
    }
    return { restarted: false, error };
  } finally {
    off();
  }
}
