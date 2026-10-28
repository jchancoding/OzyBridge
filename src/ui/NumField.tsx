import { useEffect, useRef, useState } from 'react';
import type { Range } from '../core/eq';
import { commitNumber, inRange, parseDecimal, stepValue } from '../core/step';

export function NumField({ value, step, range, unit, label, resetKey, onCommit, onBlocked }: {
  value: number; step: number; range: Range; unit: string; label: string; resetKey: string;
  onCommit: (v: number) => void; onBlocked: (blocked: boolean) => void;
}) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const lastReset = useRef(resetKey);
  const focused = useRef(false);
  const tip = `${label}: ${range.min} to ${range.max} ${unit}, step ${step}`;

  // Resync from the model on step buttons, arrow keys, undo, slot change, or graph edits.
  useEffect(() => {
    const reset = lastReset.current !== resetKey;
    lastReset.current = resetKey;
    if (reset || (!focused.current && parseDecimal(text) !== value)) {
      setText(String(value));
      setError(null);
      onBlocked(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, resetKey]);

  const typing = (t: string) => {
    setText(t);
    setError(null);
    const n = parseDecimal(t);
    if (inRange(n, range)) {
      onBlocked(false);
      if (n !== value) onCommit(n);
    } else onBlocked(true);
  };

  const finish = () => {
    const c = commitNumber(text, step, range);
    if (!c.ok) {
      setError(c.message);
      onBlocked(true);
      return;
    }
    setError(null);
    onBlocked(false);
    setText(String(c.value));
    if (c.value !== value) onCommit(c.value);
  };

  return (
    <span className="numfield">
      <input
        className={`num${error ? ' num-error' : ''}`}
        type="text"
        inputMode="decimal"
        value={text}
        title={tip}
        aria-label={tip}
        aria-invalid={error !== null}
        onChange={(e) => typing(e.target.value)}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; finish(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') return finish();
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          const base = parseDecimal(text) ?? value;
          onCommit(stepValue(base, step, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey, range));
        }}
      />
      {error && <span className="field-error" role="alert">{error}</span>}
    </span>
  );
}
