import { describe, expect, it, vi } from 'vitest';
import {
  createDraftHistory,
  createHistory,
  pushGestureAnchor,
  pushHistory,
  pushNullableHistory,
  redoNullableHistory,
  resetHistory,
  undoHistory,
  undoNullableHistory,
  HISTORY_MAX,
  type NullableHistoryState,
} from './history';

describe('history', () => {
  it('pushes, undoes, and redoes', () => {
    let h = createHistory(0);
    h = pushHistory(h, 1);
    h = pushHistory(h, 2);
    expect(h.present).toBe(2);
    const u = undoHistory(h);
    expect(u?.present).toBe(1);
  });

  it('coalesces by key within the window', () => {
    let t = 1_000;
    let h = createHistory('a');
    h = pushHistory(h, 'b', { now: t });
    t += 100;
    h = pushHistory(h, 'c', { coalesceKey: 'wheel:0', now: t });
    t += 100;
    h = pushHistory(h, 'd', { coalesceKey: 'wheel:0', now: t });
    expect(h.past).toEqual(['a', 'b']);
    expect(h.present).toBe('d');
  });

  it('caps past length', () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_MAX + 5; i++) h = pushHistory(h, i);
    expect(h.past.length).toBe(HISTORY_MAX);
    expect(h.present).toBe(HISTORY_MAX + 5);
  });

  it('reset clears stacks', () => {
    let h = pushHistory(createHistory(1), 2);
    h = resetHistory(9);
    expect(h).toEqual({ past: [], present: 9, future: [] });
  });
});

describe('nullable draft history', () => {
  const base = 0;
  const eq = (a: number, b: number) => a === b;

  it('stores null present when equal to baseline', () => {
    let h = createDraftHistory<number>();
    h = pushNullableHistory(h, base, 5, { equals: eq });
    expect(h.present).toBe(5);
    h = pushNullableHistory(h, base, 0, { equals: eq });
    expect(h.present).toBeNull();
  });

  it('skipPush updates present without growing past', () => {
    let h = createDraftHistory<number>();
    h = pushNullableHistory(h, base, 3, { equals: eq });
    h = pushNullableHistory(h, base, 7, { equals: eq, skipPush: true });
    expect(h.past).toEqual([0]);
    expect(h.present).toBe(7);
  });

  it('pushGestureAnchor adds one undo step', () => {
    let h = createDraftHistory<number>();
    h = pushGestureAnchor(h, base);
    expect(h.past).toEqual([0]);
    expect(h.present).toBe(0);
  });

  it('undoes and redoes with baseline normalization', () => {
    let h = createDraftHistory<number>();
    h = pushNullableHistory(h, base, 2, { equals: eq });
    h = undoNullableHistory(h, base, eq)!;
    expect(h.present).toBeNull();
    h = redoNullableHistory(h, base, eq)!;
    expect(h.present).toBe(2);
  });
});
