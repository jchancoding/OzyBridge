import { useRef, useState } from 'react';
import type { Preset } from '../core/presets';
import { EqGraph } from './EqGraph';

export const PRESET_DRAG_TYPE = 'application/x-ozybridge-preset';

function Card({ preset, slotLabel, busy, onRename, onDelete, onWrite }: {
  preset: Preset; slotLabel: string; busy: boolean;
  onRename: (name: string) => void; onDelete: () => void; onWrite: () => void;
}) {
  const [name, setName] = useState(preset.name);
  const [confirm, setConfirm] = useState(false);
  const bands = preset.profile.bands.filter((b) => b.enabled && b.gain !== 0).length;
  const commit = () => {
    const clean = name.trim();
    if (!clean) return setName(preset.name);
    if (clean !== preset.name) onRename(clean);
    setName(clean);
  };
  return (
    <div
      className="slot preset-card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(PRESET_DRAG_TYPE, preset.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
    >
      <div className="slot-head">
        <input
          className="slot-name"
          value={name}
          aria-label={`Name for preset ${preset.name}`}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
      </div>
      <EqGraph profile={preset.profile} thumb />
      <div className="mono caption">{bands} bands · {preset.profile.preamp.toFixed(1)} dB</div>
      <button className="btn-secondary" disabled={busy} onClick={onWrite}>Write to slot {slotLabel}</button>
      {confirm ? (
        <div className="bar">
          <button className="btn-danger" autoFocus onClick={onDelete}>Yes, delete</button>
          <button className="btn-secondary" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => setConfirm(true)}>Delete</button>
      )}
    </div>
  );
}

export function PresetLibrary({ presets, slotLabel, canSave, busy, onSave, onRename, onDelete, onWrite, onBackup, onLoad }: {
  presets: Preset[]; slotLabel: string; canSave: boolean; busy: boolean;
  onSave: () => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
  onWrite: (id: string) => void; onBackup: () => void; onLoad: (text: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <section className="preset-library">
      <h2 className="section-title">Preset library</h2>
      <div className="bar">
        <button className="btn-primary" disabled={!canSave} onClick={onSave}>Save slot {slotLabel} as preset</button>
        <button className="btn-secondary" disabled={presets.length === 0} onClick={onBackup}>Back up presets (.json)</button>
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>Load presets from file</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onLoad(await f.text());
          }}
        />
      </div>
      {presets.length === 0 ? (
        <p className="hint">
          No presets yet. Select a slot, then press <strong>Save slot {slotLabel} as preset</strong>. Saved presets stay in this browser
          and can be dragged onto any slot.
        </p>
      ) : (
        <div className="slot-grid">
          {presets.map((p) => (
            <Card
              key={p.id}
              preset={p}
              slotLabel={slotLabel}
              busy={busy}
              onRename={(n) => onRename(p.id, n)}
              onDelete={() => onDelete(p.id)}
              onWrite={() => onWrite(p.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
