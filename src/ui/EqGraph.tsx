import { useMemo } from 'react';
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
const RANGE = 15;
const x = (f: number) => L + (Math.log10(f / 20) / 3) * PW;
const y = (db: number) => T + PH / 2 - (Math.max(-RANGE, Math.min(RANGE, db)) / RANGE) * (PH / 2);

const FREQ_TICKS: [number, string][] = [
  [20, '20'], [50, '50'], [100, '100'], [200, '200'], [500, '500'],
  [1000, '1k'], [2000, '2k'], [5000, '5k'], [10000, '10k'], [20000, '20k'],
];
const DB_TICKS = [-15, -10, -5, 0, 5, 10, 15];
const REGIONS: { from: number; to: number; name: string; title: string; range: string }[] = [
  { from: 20, to: 60, name: 'Sub-bass', title: 'Sub-bass', range: '20-60' },
  { from: 60, to: 250, name: 'Bass', title: 'Bass', range: '60-250' },
  { from: 250, to: 500, name: 'Lower mids', title: 'Lower mids', range: '250-500' },
  { from: 500, to: 2000, name: 'Mids', title: 'Mids', range: '500-2k' },
  { from: 2000, to: 4000, name: 'Upper mids', title: 'Upper mids', range: '2k-4k' },
  { from: 4000, to: 6000, name: 'Presence', title: 'Presence / Lower treble', range: '4k-6k' },
  { from: 6000, to: 20000, name: 'Upper treble', title: 'Upper treble', range: '6k-20k' },
];

function curvePath(profile: EqProfile, n: number, fx: (f: number) => number, fy: (d: number) => number) {
  const f = logFrequencies(n);
  const db = profileResponseDb(profile, f);
  return {
    path: f.map((hz, i) => `${i ? 'L' : 'M'}${fx(hz).toFixed(1)} ${fy(db[i] as number).toFixed(1)}`).join(' '),
    peak: Math.max(...db),
  };
}

export function EqGraph({ profile, thumb = false, label = 'Current', compare }: {
  profile: EqProfile; thumb?: boolean; label?: string; compare?: { profile: EqProfile; label: string };
}) {
  const cmpPath = useMemo(
    () => (!thumb && compare ? curvePath(compare.profile, 260, x, y).path : null),
    [compare, thumb],
  );
  const { path, peak } = useMemo(
    () =>
      thumb
        ? curvePath(profile, 60, (f) => (Math.log10(f / 20) / 3) * 100, (d) => 24 - (Math.max(-RANGE, Math.min(RANGE, d)) / RANGE) * 24)
        : curvePath(profile, 260, x, y),
    [profile, thumb],
  );

  if (thumb) {
    return (
      <svg className="graph graph-thumb" viewBox="0 0 100 48" preserveAspectRatio="none" role="img" aria-label={`EQ thumbnail, peak ${peak.toFixed(1)} dB`}>
        <line x1={0} x2={100} y1={24} y2={24} className="graph-zero" vectorEffect="non-scaling-stroke" />
        <path d={path} className="graph-curve" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  return (
    <svg className="graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`EQ response, peak ${peak.toFixed(1)} dB${compare ? `, compared with ${compare.label}` : ''}`}>
      {REGIONS.map((r, i) => (
        <g key={r.name}>
          <title>{`${r.title} ${r.range} Hz`}</title>
          <rect x={x(r.from)} y={T} width={x(r.to) - x(r.from)} height={PH} className={i % 2 ? 'region region-b' : 'region'} />
          <text x={(x(r.from) + x(r.to)) / 2} y={T - 22} className="graph-region" textAnchor="middle">{r.name}</text>
          <text x={(x(r.from) + x(r.to)) / 2} y={T - 8} className="graph-region graph-region-range" textAnchor="middle">{r.range}</text>
        </g>
      ))}
      {DB_TICKS.map((d) => (
        <g key={d}>
          <line x1={L} x2={W - R} y1={y(d)} y2={y(d)} className={d === 0 ? 'graph-zero' : 'graph-grid'} />
          <text x={L - 8} y={y(d) + 4} className={d === 0 ? 'graph-tick graph-tick-zero' : 'graph-tick'} textAnchor="end">{d > 0 ? `+${d}` : d}</text>
        </g>
      ))}
      {FREQ_TICKS.map(([f, label]) => (
        <g key={f}>
          <line x1={x(f)} x2={x(f)} y1={T} y2={T + PH} className="graph-grid" />
          <text x={x(f)} y={T + PH + 18} className="graph-tick" textAnchor="middle">{label}</text>
        </g>
      ))}
      <rect x={L} y={T} width={PW} height={PH} className="graph-frame" />
      {peak > 0 && <rect x={L} y={T} width={PW} height={y(0) - T} className="graph-clip" />}
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
      <text x={L + PW / 2} y={H - 8} className="graph-axis" textAnchor="middle">Frequency (Hz)</text>
      <text transform={`translate(14 ${T + PH / 2}) rotate(-90)`} className="graph-axis" textAnchor="middle">Gain (dB)</text>
    </svg>
  );
}
