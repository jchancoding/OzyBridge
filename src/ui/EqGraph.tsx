import { useMemo, type CSSProperties } from 'react';
import type { EqProfile } from '../core/eq';
import { logFrequencies, profileResponseDb } from '../core/response';

const W = 1000;
const H = 380;
const L = 62;
const R = 14;
const T = 44;
const B = 52;
const PW = W - L - R;
const PH = H - T - B;
const BASE_RANGE = 15;
const RANGE_STEPS = [15, 18, 24, 30, 36, 48, 60, 72, 96];
const THUMB_H = 48;
const THUMB_PAD = 2;
const x = (f: number) => L + (Math.log10(f / 20) / 3) * PW;

const FREQ_TICKS: [number, string][] = [
  [20, '20'], [50, '50'], [100, '100'], [200, '200'], [500, '500'],
  [1000, '1k'], [2000, '2k'], [5000, '5k'], [10000, '10k'], [20000, '20k'],
];

function finite(db: number): number {
  return Number.isFinite(db) ? db : 0;
}

// ±15 dB unless the summed curve (or the comparison) sticks out. Then pick the
// next larger axis so the peak stays inside the frame instead of being pinned to it.
export function graphDbRange(samples: number[]): number {
  let peak = 0;
  for (const v of samples) if (Number.isFinite(v)) peak = Math.max(peak, Math.abs(v));
  if (peak <= BASE_RANGE) return BASE_RANGE;
  const needed = Math.max(peak + 1, peak * 1.08);
  for (const step of RANGE_STEPS) if (step >= needed) return step;
  return Math.ceil(needed / 12) * 12;
}

export function graphDbTicks(range: number): number[] {
  const nice = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 24];
  let step = range;
  let best = Infinity;
  for (const s of nice) {
    if (range % s !== 0) continue;
    const perSide = range / s;
    if (perSide < 3 || perSide > 6) continue;
    const dist = Math.abs(perSide - 4);
    if (dist < best || (dist === best && s > step)) {
      best = dist;
      step = s;
    }
  }
  const n = range / step;
  const ticks: number[] = [];
  for (let i = -n; i <= n; i++) ticks.push(i * step);
  return ticks;
}

export function mainPlotY(db: number, range: number): number {
  return T + PH / 2 - (finite(db) / range) * (PH / 2);
}

export function thumbPlotY(db: number, range: number): number {
  const mid = THUMB_H / 2;
  return mid - (finite(db) / range) * (mid - THUMB_PAD);
}

const REGIONS: { from: number; to: number; name: string; title: string; range: string }[] = [
  { from: 20, to: 60, name: 'Sub-bass', title: 'Sub-bass', range: '20-60' },
  { from: 60, to: 250, name: 'Bass', title: 'Bass', range: '60-250' },
  { from: 250, to: 500, name: 'Lower mids', title: 'Lower mids', range: '250-500' },
  { from: 500, to: 2000, name: 'Mids', title: 'Mids', range: '500-2k' },
  { from: 2000, to: 4000, name: 'Upper mids', title: 'Upper mids', range: '2k-4k' },
  { from: 4000, to: 6000, name: 'Presence', title: 'Presence / Lower treble', range: '4k-6k' },
  { from: 6000, to: 20000, name: 'Upper treble', title: 'Upper treble', range: '6k-20k' },
];

function sampleCurve(profile: EqProfile, n: number) {
  const f = logFrequencies(n);
  const db = profileResponseDb(profile, f);
  const finiteDb = db.filter(Number.isFinite);
  return { f, db, peak: finiteDb.length ? Math.max(...finiteDb) : 0 };
}

function toPath(f: number[], db: number[], fx: (hz: number) => number, fy: (d: number) => number) {
  return f.map((hz, i) => `${i ? 'L' : 'M'}${fx(hz).toFixed(1)} ${fy(db[i] as number).toFixed(1)}`).join(' ');
}

export function EqGraph({ profile, thumb = false, label = 'Current', compare, sweep = 0 }: {
  profile: EqProfile; thumb?: boolean; label?: string; compare?: { profile: EqProfile; label: string }; sweep?: number;
}) {
  const drawn = useMemo(() => {
    const n = thumb ? 60 : 260;
    const fx = thumb ? (f: number) => (Math.log10(f / 20) / 3) * 100 : x;
    const main = sampleCurve(profile, n);
    const cmp = !thumb && compare ? sampleCurve(compare.profile, 260) : null;
    const range = graphDbRange(cmp ? [...main.db, ...cmp.db] : main.db);
    const fy = thumb ? (d: number) => thumbPlotY(d, range) : (d: number) => mainPlotY(d, range);
    return {
      path: toPath(main.f, main.db, fx, fy),
      peak: main.peak,
      range,
      ticks: graphDbTicks(range),
      cmpPath: cmp ? toPath(cmp.f, cmp.db, x, fy) : null,
    };
  }, [profile, compare, thumb]);
  const { path, peak, range, ticks, cmpPath } = drawn;

  if (thumb) {
    return (
      <svg className="graph graph-thumb" viewBox={`0 0 100 ${THUMB_H}`} preserveAspectRatio="none" role="img" aria-label={`EQ thumbnail, peak ${peak.toFixed(1)} dB${range > BASE_RANGE ? `, scale ±${range} dB` : ''}`}>
        <line x1={0} x2={100} y1={24} y2={24} className="graph-zero" vectorEffect="non-scaling-stroke" />
        <path d={path} className="graph-curve" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  return (
    <svg className="graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`EQ response, peak ${peak.toFixed(1)} dB, scale ±${range} dB${compare ? `, compared with ${compare.label}` : ''}`}>
      {REGIONS.map((r, i) => (
        <g key={r.name}>
          <title>{`${r.title} ${r.range} Hz`}</title>
          <rect x={x(r.from)} y={T} width={x(r.to) - x(r.from)} height={PH} className={i % 2 ? 'region region-b' : 'region'} />
          <text x={(x(r.from) + x(r.to)) / 2} y={T - 22} className="graph-region" textAnchor="middle">{r.name}</text>
          <text x={(x(r.from) + x(r.to)) / 2} y={T - 8} className="graph-region graph-region-range" textAnchor="middle">{r.range}</text>
        </g>
      ))}
      {ticks.map((d) => (
        <g key={d}>
          <line x1={L} x2={W - R} y1={mainPlotY(d, range)} y2={mainPlotY(d, range)} className={d === 0 ? 'graph-zero' : 'graph-grid'} />
          <text x={L - 8} y={mainPlotY(d, range) + 4} className={d === 0 ? 'graph-tick graph-tick-zero' : 'graph-tick'} textAnchor="end">{d > 0 ? `+${d}` : d}</text>
        </g>
      ))}
      {FREQ_TICKS.map(([f, label]) => (
        <g key={f}>
          <line x1={x(f)} x2={x(f)} y1={T} y2={T + PH} className="graph-grid" />
          <text x={x(f)} y={T + PH + 18} className="graph-tick" textAnchor="middle">{label}</text>
        </g>
      ))}
      <rect x={L} y={T} width={PW} height={PH} className="graph-frame" />
      {peak > 0 && <rect x={L} y={T} width={PW} height={mainPlotY(0, range) - T} className="graph-clip" />}
      {cmpPath && <path d={cmpPath} className="graph-curve-2" />}
      <path d={path} className="graph-curve" />
      {compare && (
        <g className="graph-legend">
          {[{ name: label, cls: 'graph-curve' }, { name: compare.label, cls: 'graph-curve-2' }].map((e, i) => (
            <g key={i} transform={`translate(${W - R - 150} ${T + 16 + i * 18})`}>
              <line x1={0} x2={22} y1={0} y2={0} className={e.cls} />
              <text x={28} y={4} className="graph-legend-text">{e.name.length > 18 ? `${e.name.slice(0, 17)}…` : e.name}</text>
            </g>
          ))}
        </g>
      )}
      {sweep > 0 && (
        <svg key={sweep} x={L} y={T} width={PW} height={PH} overflow="hidden" aria-hidden>
          <g className="graph-sweep" style={{ '--sweep-w': `${PW}px` } as CSSProperties}>
            <rect x={-60} y={0} width={60} height={PH} className="graph-sweep-wash" />
            <rect x={-2} y={0} width={2} height={PH} className="graph-sweep-line" />
          </g>
        </svg>
      )}
      <text x={L + PW / 2} y={H - 8} className="graph-axis" textAnchor="middle">Frequency (Hz)</text>
      <text transform={`translate(14 ${T + PH / 2}) rotate(-90)`} className="graph-axis" textAnchor="middle">Gain (dB)</text>
    </svg>
  );
}
