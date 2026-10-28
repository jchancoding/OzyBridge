export type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
  lastCoalesce?: { key: string; at: number };
};

export type PushHistoryOpts = {
  coalesceKey?: string;
  coalesceMs?: number;
  max?: number;
  now?: number;
};

export const HISTORY_MAX = 100;
export const HISTORY_COALESCE_MS = 500;

export function createHistory<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [] };
}

export function presentOr<T>(state: NullableHistoryState<T>, fallback: T): T {
  return state.present ?? fallback;
}

export function replacePresent<T>(state: HistoryState<T>, next: T): HistoryState<T> {
  return state.present === next ? state : { ...state, present: next };
}

export function pushHistory<T>(
  state: HistoryState<T>,
  next: T,
  opts?: PushHistoryOpts,
): HistoryState<T> {
  const max = opts?.max ?? HISTORY_MAX;
  const coalesceMs = opts?.coalesceMs ?? HISTORY_COALESCE_MS;
  const now = opts?.now ?? Date.now();
  if (
    opts?.coalesceKey &&
    state.lastCoalesce?.key === opts.coalesceKey &&
    now - state.lastCoalesce.at < coalesceMs
  ) {
    return { ...state, present: next, lastCoalesce: { key: opts.coalesceKey, at: now } };
  }
  const past = [...state.past, state.present].slice(-max);
  return {
    past,
    present: next,
    future: [],
    lastCoalesce: opts?.coalesceKey ? { key: opts.coalesceKey, at: now } : undefined,
  };
}

export type NullableHistoryState<T> = {
  past: T[];
  present: T | null;
  future: T[];
  lastCoalesce?: { key: string; at: number };
};

export type NullablePushOpts<T> = PushHistoryOpts & {
  equals?: (a: T, b: T) => boolean;
  skipPush?: boolean;
};

/** Draft stack: `present` null means “same as baseline” (no unsaved edits). */
export function pushNullableHistory<T>(
  state: NullableHistoryState<T>,
  baseline: T,
  next: T,
  opts?: NullablePushOpts<T>,
): NullableHistoryState<T> {
  const eq = opts?.equals ?? ((a, b) => a === b);
  const cur = presentOr(state, baseline);
  if (eq(cur, next)) return state;
  const sentinel = eq(next, baseline) ? null : next;
  if (opts?.skipPush) {
    return { ...state, present: sentinel };
  }
  const pushed = pushHistory(
    { past: state.past, present: cur, future: state.future, lastCoalesce: state.lastCoalesce },
    next,
    opts,
  );
  return {
    past: pushed.past,
    present: sentinel,
    future: pushed.future,
    lastCoalesce: pushed.lastCoalesce,
  };
}

/** Record one undo step before a continuous gesture (e.g. graph drag). */
export function pushGestureAnchor<T>(
  state: NullableHistoryState<T>,
  baseline: T,
): NullableHistoryState<T> {
  const cur = presentOr(state, baseline);
  return {
    past: [...state.past, cur].slice(-HISTORY_MAX),
    present: state.present ?? cur,
    future: [],
    lastCoalesce: undefined,
  };
}

export function undoHistory<T>(state: HistoryState<T>): HistoryState<T> | null {
  if (state.past.length === 0) return null;
  const present = state.past[state.past.length - 1] as T;
  const past = state.past.slice(0, -1);
  const future = [state.present, ...state.future];
  return { past, present, future, lastCoalesce: undefined };
}

export function redoHistory<T>(state: HistoryState<T>): HistoryState<T> | null {
  if (state.future.length === 0) return null;
  const present = state.future[0] as T;
  const future = state.future.slice(1);
  const past = [...state.past, state.present].slice(-HISTORY_MAX);
  return { past, present, future, lastCoalesce: undefined };
}

export function undoNullableHistory<T>(
  state: NullableHistoryState<T>,
  baseline: T,
  equals: (a: T, b: T) => boolean,
): NullableHistoryState<T> | null {
  const u = undoHistory({
    past: state.past,
    present: presentOr(state, baseline),
    future: state.future,
  });
  if (!u) return null;
  return {
    past: u.past,
    present: equals(u.present, baseline) ? null : u.present,
    future: u.future,
    lastCoalesce: undefined,
  };
}

export function redoNullableHistory<T>(
  state: NullableHistoryState<T>,
  baseline: T,
  equals: (a: T, b: T) => boolean,
): NullableHistoryState<T> | null {
  const r = redoHistory({
    past: state.past,
    present: presentOr(state, baseline),
    future: state.future,
  });
  if (!r) return null;
  return {
    past: r.past,
    present: equals(r.present, baseline) ? null : r.present,
    future: r.future,
    lastCoalesce: undefined,
  };
}

export function createDraftHistory<T>(): NullableHistoryState<T> {
  return { past: [], present: null, future: [] };
}

export function resetHistory<T>(present: T): HistoryState<T> {
  return createHistory(present);
}

export function resetDraftHistory<T>(): NullableHistoryState<T> {
  return createDraftHistory();
}
