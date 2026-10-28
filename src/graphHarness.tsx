import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { EqBand, EqProfile } from './core/eq';
import { EqGraph } from './ui/EqGraph';
import { addBandAt, deleteBand } from './core/graphEdit';
import { GraphKeysLegend } from './ui/GraphKeysLegend';
import './ui/tokens.css';
import './App.css';

const pk = (freq: number, gain: number, q: number): EqBand => ({ type: 'PK', freq, gain, q, enabled: true });
const start: EqProfile = {
  preamp: -1.8,
  bands: [pk(24, -4.6, 0.3), pk(290, 2.1, 0.5), pk(1600, 1.2, 1), pk(2900, -4.7, 2), pk(4200, 2.7, 3.2), pk(6000, -9.3, 2.2),
    { ...pk(8000, 0, 1), enabled: false }, { ...pk(10000, 0, 1), enabled: false }, { ...pk(12000, 0, 1), enabled: false }, { ...pk(16000, 0, 1), enabled: false }],
};
const cap = { freq: { min: 20, max: 20000 }, gain: { min: -24, max: 12 }, q: { min: 0.25, max: 8 }, step: { freq: 1, gain: 0.1, q: 0.01 } };

function H() {
  const [p, setP] = useState(start);
  const [sel, setSel] = useState<number | null>(null);
  (window as unknown as { __p: EqProfile }).__p = p;
  return (
    <main className="app" style={{ maxWidth: 1280 }}>
      <section className="eq-view" style={{ width: '100%' }}>
        <EqGraph profile={p} label="Test" onNotice={(t) => { (window as unknown as { __notice: string }).__notice = t; }} editable={{
          selected: sel, onSelect: setSel, cap: { ...cap, maxBands: 10 },
          onChange: (i, patch) => setP((o) => ({ ...o, bands: o.bands.map((b, j) => (j === i ? { ...b, ...patch } : b)) })),
          onAdd: (f, g) => { const r = addBandAt(p, f, g, cap); if (!r) return null; setP(r.profile); return r.index; },
          onDelete: (i) => { setP(deleteBand(p, i)); setSel(null); },
        }} />
        <GraphKeysLegend id="keys" filterTypes={['PK', 'LSC', 'HSC']} />
      </section>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<H />);
