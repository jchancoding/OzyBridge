import { useEffect, useRef, useState } from 'react';
import { parseMeasurement, type Measurement } from '../core/measurement';
import { TARGETS, targetUrl, type TargetCurve } from '../core/targets';

export interface TargetOverlay {
  id: string;
  name: string;
  measurement: Measurement;
}

const cache = new Map<string, Measurement>();

export async function loadTarget(t: TargetCurve): Promise<Measurement> {
  const hit = cache.get(t.id);
  if (hit) return hit;
  const res = await fetch(targetUrl(import.meta.env.BASE_URL, t), { credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const m = parseMeasurement(await res.text());
  cache.set(t.id, m);
  return m;
}

export function TargetToggles({ onChange }: { onChange: (list: TargetOverlay[]) => void }) {
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    cb.current(
      TARGETS.filter((t) => on[t.id] && cache.has(t.id)).map((t) => ({
        id: t.id,
        name: t.name,
        measurement: cache.get(t.id) as Measurement,
      })),
    );
  }, [on]);

  const toggle = async (t: TargetCurve) => {
    if (on[t.id]) {
      setOn((o) => ({ ...o, [t.id]: false }));
      return;
    }
    setErrors((e) => ({ ...e, [t.id]: false }));
    try {
      await loadTarget(t);
      setOn((o) => ({ ...o, [t.id]: true }));
    } catch {
      setErrors((e) => ({ ...e, [t.id]: true }));
    }
  };

  return (
    <div className="overlays__row">
      <span className="label">TARGETS</span>
      {TARGETS.map((t) => (
        <button key={t.id} type="button" className="btn-secondary target-toggle" aria-pressed={!!on[t.id]} onClick={() => void toggle(t)}>
          {t.name}
        </button>
      ))}
      {TARGETS.filter((t) => errors[t.id]).map((t) => (
        <span key={t.id} className="fr-error" role="status">Could not load the {t.name} target.</span>
      ))}
    </div>
  );
}
