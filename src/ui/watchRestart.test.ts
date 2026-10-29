import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceAdapter } from '../devices/types';
import { watchRestart } from './watchRestart';

function mockAdapter(): { adapter: DeviceAdapter; disconnect: () => void } {
  let handler: (() => void) | null = null;
  const adapter = {
    onDisconnect(cb: () => void) {
      handler = cb;
      return () => {
        handler = null;
      };
    },
  } as unknown as DeviceAdapter;
  return {
    adapter,
    disconnect: () => handler?.(),
  };
}

describe('watchRestart', () => {
  let time = 0;
  const sleep = async (ms: number) => {
    time += ms;
  };
  const now = () => time;

  beforeEach(() => {
    time = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns restarted=true when disconnect happens during work that throws', async () => {
    const { adapter, disconnect } = mockAdapter();
    const r = await watchRestart(
      adapter,
      async () => {
        disconnect();
        throw new Error('read-back failed');
      },
      { sleep, now },
    );
    expect(r.restarted).toBe(true);
    expect(r.error).toBeInstanceOf(Error);
  });

  it('returns restarted=false with error when work throws and there is no disconnect', async () => {
    const { adapter } = mockAdapter();
    const r = await watchRestart(
      adapter,
      async () => {
        throw new Error('write failed');
      },
      { sleep, now },
    );
    expect(r.restarted).toBe(false);
    expect(r.error).toBeInstanceOf(Error);
  });

  it('returns restarted=true when disconnect happens within the post-work window', async () => {
    const { adapter, disconnect } = mockAdapter();
    const r = await watchRestart(
      adapter,
      async () => {},
      {
        sleep: async (ms) => {
          disconnect();
          time += ms;
        },
        now,
      },
    );
    expect(r.restarted).toBe(true);
    expect(r.error).toBe(null);
  });
});
