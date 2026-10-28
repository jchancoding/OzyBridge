import { useCallback, useRef, useState } from 'react';
import type { EqProfile } from '../core/eq';
import { profilesEqual } from '../core/eq';
import {
  createDraftHistory,
  pushGestureAnchor,
  pushNullableHistory,
  redoNullableHistory,
  resetDraftHistory,
  undoNullableHistory,
  type NullableHistoryState,
} from '../core/history';

export function useEqDraft(base: EqProfile | undefined) {
  const [editHist, setEditHist] = useState<NullableHistoryState<EqProfile>>(() => createDraftHistory());
  const dragHistSkip = useRef(false);

  const clear = useCallback(() => {
    dragHistSkip.current = false;
    setEditHist(resetDraftHistory());
  }, []);

  const apply = useCallback(
    (next: EqProfile, opts?: { coalesceKey?: string; skipPush?: boolean }) => {
      if (!base) return;
      setEditHist((h) => pushNullableHistory(h, base, next, { ...opts, equals: profilesEqual }));
    },
    [base],
  );

  const beginDrag = useCallback(() => {
    if (!base || dragHistSkip.current) return;
    dragHistSkip.current = true;
    setEditHist((h) => pushGestureAnchor(h, base));
  }, [base]);

  const endDrag = useCallback(() => {
    dragHistSkip.current = false;
  }, []);

  const undo = useCallback(() => {
    if (!base) return;
    setEditHist((h) => undoNullableHistory(h, base, profilesEqual) ?? h);
  }, [base]);

  const redo = useCallback(() => {
    if (!base) return;
    setEditHist((h) => redoNullableHistory(h, base, profilesEqual) ?? h);
  }, [base]);

  const draft = editHist.present;
  return {
    draft,
    shown: draft ?? base,
    canUndo: editHist.past.length > 0,
    canRedo: editHist.future.length > 0,
    clear, apply, beginDrag, endDrag, undo, redo,
  };
}
