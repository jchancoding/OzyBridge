import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import type { EqBand, EqProfile, FilterType } from '../core/eq';
import {
  bandsAtCap,
  dragGain,
  freqFromRatio,
  gainAtCursor,
  isUnused,
  maxBandCount,
  nearCurve,
  nearestBand,
  nudgeFreq,
  ratioFromFreq,
  snapBand,
  wheelQ,
  type GraphEditCap,
} from '../core/graphEdit';
import {
  clampView,
  defaultView,
  HALF_SPAN_NOTCHES,
  VIEW_HALF_SPAN_MAX,
  panView,
  ticksFor,
  viewDbMax,
  viewDbMin,
  zoomViewNotch,
  type GraphView,
} from '../core/graphView';
import { bandResponseDb, logFrequencies, profileResponseDb } from '../core/response';
import { stepValue } from '../core/step';
import { equalizedResponse, type Measurement } from '../core/measurement';
import { targetCurve } from '../core/targets';

const TARGET_DASHES = ['2 4', '8 4', '12 4 2 4', '1 3'];
const HANDLE_R_COARSE = 22;
const HANDLE_SCALE_COARSE = 1.5;
const OVERLAY_N = 260;

function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

export const DEFAULT_GRAPH_W = 1000;
export const DEFAULT_GRAPH_H = 420;
const L = 62;
const R = 14;
const T = 44;
const B = 52;
const BASE_RANGE = 15;
const RANGE_STEPS = [15, 18, 24, 30, 36, 48, 60, 72, 96];
const THUMB_H = 48;
const THUMB_PAD = 2;
const HANDLE_R = 18;
const HANDLE_SIZE = 7;
const EDGE_PAN_PX = 12;
const EDGE_PAN_DB = 1;
const CURVE_HIT_PX = 40;
const CURVE_CREATE_TOL = 12;
const ZOOM_ACCUM_THRESHOLD = 40;
const REGION_CHAR_PX = 7;
const HANDLE_OVERLAP_PX = 14;
const LABEL_STACK_PX = 11;
const AXIS_LOCK_PX = 6;
const DRAG_THRESHOLD_PX = 3;
const BAND_SAMPLES = 120;

export type GraphEditMeta = { coalesceKey?: string; skipPush?: boolean };

type DragState = {
  index: number;
  startPx: number;
  startPy: number;
  moved: boolean;
  axisLock: 'x' | 'y' | null;
  fine: boolean;
  shift: boolean;
  anchorPx: number;
  anchorPy: number;
  anchorFreq: number;
  anchorGain: number;
  overlap: number[];
  overlapCycle: number;
  grabOffsetX: number;
  grabOffsetY: number;
  editing: boolean;
};

type CreateState = {
  startPx: number;
  startPy: number;
  freq: number;
  gain: number;
  moved: boolean;
  noticed: boolean;
  blocked: boolean;
};

export type PlotGeom = { W: number; H: number; L: number; R: number; T: number; B: number; PW: number; PH: number };

export function plotGeom(w: number, h: number): PlotGeom {
  return { W: w, H: h, L, R, T, B, PW: w - L - R, PH: h - T - B };
}

const DEFAULT_GEOM = plotGeom(DEFAULT_GRAPH_W, DEFAULT_GRAPH_H);

const freqX = (f: number, geom: PlotGeom) => geom.L + ratioFromFreq(f) * geom.PW;

const FREQ_TICKS: [number, string][] = [
  [20, '20'], [50, '50'], [100, '100'], [200, '200'], [500, '500'],
  [1000, '1k'], [2000, '2k'], [5000, '5k'], [10000, '10k'], [20000, '20k'],
];

function finite(db: number): number {
  return Number.isFinite(db) ? db : 0;
}

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

export function mainPlotY(db: number, rangeOrView: number | GraphView, geom: PlotGeom = DEFAULT_GEOM): number {
  const center = typeof rangeOrView === 'number' ? 0 : rangeOrView.center;
  const halfSpan = typeof rangeOrView === 'number' ? rangeOrView : rangeOrView.halfSpan;
  return geom.T + geom.PH / 2 - ((finite(db) - center) / halfSpan) * (geom.PH / 2);
}

function plotDbFromY(y: number, view: GraphView, geom: PlotGeom): number {
  return ((geom.T + geom.PH / 2 - y) / (geom.PH / 2)) * view.halfSpan + view.center;
}

export function thumbPlotY(db: number, range: number): number {
  const mid = THUMB_H / 2;
  return mid - (finite(db) / range) * (mid - THUMB_PAD);
}

function scaleLabel(view: GraphView): string {
  if (view.center === 0) return `±${view.halfSpan} dB`;
  return `${viewDbMin(view).toFixed(0)} to ${viewDbMax(view).toFixed(0)} dB`;
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

function sampleCurve(profile: EqProfile, n: number, includePreamp: boolean) {
  const f = logFrequencies(n);
  const db = profileResponseDb(profile, f, 48000, includePreamp);
  const finiteDb = db.filter(Number.isFinite);
  return { f, db, peak: finiteDb.length ? Math.max(...finiteDb) : 0 };
}

function toPath(f: number[], db: number[], fx: (hz: number) => number, fy: (d: number) => number) {
  return f.map((hz, i) => `${i ? 'L' : 'M'}${fx(hz).toFixed(1)} ${fy(db[i] as number).toFixed(1)}`).join(' ');
}

type HandleDraw = {
  index: number;
  x: number;
  y: number;
  band: EqBand;
  offScreen: 'top' | 'bottom' | null;
};

function bandHandles(profile: EqProfile, view: GraphView, geom: PlotGeom): HandleDraw[] {
  return profile.bands.map((b, index) => {
    const db = profileResponseDb(profile, [b.freq], 48000, false)[0] as number;
    const x = freqX(b.freq, geom);
    const y = mainPlotY(db, view, geom);
    let offScreen: 'top' | 'bottom' | null = null;
    if (y < geom.T) offScreen = 'top';
    else if (y > geom.T + geom.PH) offScreen = 'bottom';
    return { index, x, y, band: b, offScreen };
  });
}

function handleHitPoints(handles: HandleDraw[], geom: PlotGeom): { x: number; y: number }[] {
  return handles.map((h) => {
    if (h.offScreen === 'top') return { x: h.x, y: geom.T + 10 };
    if (h.offScreen === 'bottom') return { x: h.x, y: geom.T + geom.PH - 10 };
    return { x: h.x, y: h.y };
  });
}

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const m = svg.getScreenCTM()?.inverse();
  if (!m) return { x: 0, y: 0 };
  const p = pt.matrixTransform(m);
  return { x: p.x, y: p.y };
}

function inPlot(px: number, py: number, geom: PlotGeom) {
  return px >= geom.L && px <= geom.L + geom.PW && py >= geom.T && py <= geom.T + geom.PH;
}

function clampPlotX(px: number, geom: PlotGeom) {
  return Math.min(geom.L + geom.PW, Math.max(geom.L, px));
}

function clampPlotY(py: number, geom: PlotGeom) {
  return Math.min(geom.T + geom.PH, Math.max(geom.T, py));
}

function formatTick(d: number): string {
  const r = Math.abs(d) < 0.05 ? 0 : d;
  if (r === 0) return '0';
  return r > 0 ? `+${r}` : String(r);
}

function safePointerCapture(svg: SVGSVGElement, pointerId: number) {
  try {
    svg.setPointerCapture(pointerId);
  } catch {
    /* NotFoundError when pointer is invalid */
  }
}

function safePointerRelease(svg: SVGSVGElement, pointerId: number) {
  try {
    if (svg.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId);
  } catch {
    /* ignore */
  }
}

function BandTipBox({
  text,
  anchorX,
  anchorY,
  geom,
}: {
  text: string;
  anchorX: number;
  anchorY: number;
  geom: PlotGeom;
}) {
  const textRef = useRef<SVGTextElement>(null);
  const [boxW, setBoxW] = useState(text.length * 7 + 12);
  const padX = 6;
  const padY = 4;
  const boxH = 18;

  useLayoutEffect(() => {
    const el = textRef.current;
    if (el && typeof el.getComputedTextLength === 'function') {
      setBoxW(el.getComputedTextLength() + padX * 2);
    } else {
      setBoxW(text.length * 7 + padX * 2);
    }
  }, [text]);

  let bx = anchorX + 14;
  let by = anchorY - boxH - 8;
  if (bx + boxW > geom.L + geom.PW) bx = anchorX - boxW - 14;
  bx = Math.min(geom.L + geom.PW - boxW, Math.max(geom.L, bx));
  if (by < geom.T) by = anchorY + HANDLE_SIZE + 10;
  if (by + boxH > geom.T + geom.PH) by = geom.T + geom.PH - boxH - 4;

  return (
    <g className="graph-tip" pointerEvents="none">
      <rect x={bx} y={by} width={boxW} height={boxH} className="graph-tip-box" />
      <text ref={textRef} x={bx + padX} y={by + boxH - padY - 2} className="graph-tip-text">
        {text}
      </text>
    </g>
  );
}

function formatBandTip(index: number, band: EqBand): string {
  const hz = band.freq >= 1000 ? `${(band.freq / 1000).toFixed(2)} kHz` : `${Math.round(band.freq)} Hz`;
  const g = `${band.gain >= 0 ? '+' : ''}${band.gain.toFixed(1)} dB`;
  return `${String(index + 1).padStart(2, '0')} · ${hz} · ${g} · Q ${band.q.toFixed(2)} · ${band.type}`;
}

function handlesInRadius(handles: HandleDraw[], geom: PlotGeom, px: number, py: number, r: number): number[] {
  const pts = handleHitPoints(handles, geom);
  const out: number[] = [];
  for (let i = 0; i < handles.length; i++) {
    const p = pts[i];
    const h = handles[i];
    if (!p || !h) continue;
    const dx = p.x - px;
    const dy = p.y - py;
    if (dx * dx + dy * dy <= r * r) out.push(h.index);
  }
  return out;
}

function stackHandleLabels(handles: HandleDraw[], geom: PlotGeom): Map<number, number> {
  const offsets = new Map<number, number>();
  const pts = handles.map((h) => {
    const y = h.offScreen === 'top' ? geom.T + 12 : h.offScreen === 'bottom' ? geom.T + geom.PH - 12 : h.y;
    return { index: h.index, x: h.x, y };
  });
  const used = new Set<number>();
  for (const a of pts) {
    if (used.has(a.index)) continue;
    const group = pts.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) <= HANDLE_OVERLAP_PX);
    group.sort((x, y) => x.y - y.y);
    group.forEach((g, i) => {
      offsets.set(g.index, -i * LABEL_STACK_PX);
      used.add(g.index);
    });
  }
  return offsets;
}

export function EqGraph({
  profile,
  thumb = false,
  label = 'Current',
  compare,
  measurement,
  targets,
  sweep = 0,
  editable,
  hintId,
  onNotice,
}: {
  profile: EqProfile;
  thumb?: boolean;
  label?: string;
  compare?: { profile: EqProfile; label: string };
  measurement?: { label: string; measurement: Measurement };
  targets?: { id: string; name: string; measurement: Measurement }[];
  sweep?: number;
  editable?: {
    selected: number | null;
    onSelect: (i: number | null) => void;
    onChange: (i: number, patch: Partial<EqBand>, meta?: GraphEditMeta) => void;
    onAdd?: (freq: number, gain: number, meta?: GraphEditMeta) => number | null;
    onDelete?: (i: number) => void;
    onEditStart?: () => void;
    onEditEnd?: () => void;
    cap: GraphEditCap;
    filterTypes?: FilterType[];
  };
  hintId?: string;
  onNotice?: (text: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const plotClipId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const coarse = useMemo(() => isCoarsePointer(), []);
  const hitR = coarse ? Math.max(HANDLE_R, HANDLE_R_COARSE) : HANDLE_R;
  const [size, setSize] = useState({ w: DEFAULT_GRAPH_W, h: DEFAULT_GRAPH_H });
  const geom = useMemo(() => plotGeom(size.w, size.h), [size]);

  const defaultV = useMemo(() => defaultView(editable?.cap.gain), [editable?.cap.gain]);
  const [view, setView] = useState<GraphView>(() => defaultV);
  const viewRef = useRef(view);
  viewRef.current = view;

  const dragRef = useRef<DragState | null>(null);
  const createRef = useRef<CreateState | null>(null);
  const panRef = useRef<{ startY: number; startCenter: number; moved: boolean } | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [panning, setPanning] = useState(false);
  const [hoverBand, setHoverBand] = useState<number | null>(null);
  const [limitHint, setLimitHint] = useState<string | null>(null);
  const zoomAccum = useRef(0);
  const wheelCtx = useRef<{ editable?: typeof editable; profile: EqProfile; hover: number | null; view: GraphView }>({
    profile,
    hover: null,
    view: defaultV,
  });
  wheelCtx.current = { editable, profile, hover: hoverBand, view };

  useEffect(() => {
    if (thumb) return;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr?.width) return;
      const w = Math.max(320, Math.round(cr.width));
      const h = Math.max(260, Math.round(cr.height));
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [thumb]);

  const overlay = useMemo(() => {
    if (thumb || (!measurement && !(targets && targets.length))) return null;
    const f = logFrequencies(OVERLAY_N);
    const eq = measurement ? equalizedResponse(measurement.measurement, profile, f) : null;
    return {
      f,
      original: eq?.original ?? null,
      equalized: eq?.equalized ?? null,
      targets: (targets ?? []).map((t) => ({ id: t.id, name: t.name, db: targetCurve(t.measurement, f) })),
    };
  }, [thumb, measurement, targets, profile]);
  const overlayDb = useMemo(() => {
    if (!overlay) return [] as number[];
    return [...(overlay.original ?? []), ...(overlay.equalized ?? []), ...overlay.targets.flatMap((t) => t.db)].filter(Number.isFinite);
  }, [overlay]);

  const autoRange = useMemo(() => {
    const n = thumb ? 60 : 260;
    const main = sampleCurve(profile, n, true);
    const cmp = !thumb && compare ? sampleCurve(compare.profile, 260, true) : null;
    return graphDbRange([...main.db, ...(cmp ? cmp.db : []), ...overlayDb]);
  }, [profile, compare, thumb, overlayDb]);

  const staticView = useMemo(
    () => (overlayDb.length && autoRange > 24 ? clampView({ center: 0, halfSpan: autoRange }) : defaultView()),
    [overlayDb.length, autoRange],
  );
  const plotView = editable ? view : staticView;

  const overlayKey = overlay ? `${measurement?.label ?? ''}|${(targets ?? []).map((t) => t.id).join(',')}` : '';
  const widenedFor = useRef('');
  useEffect(() => {
    // Widen once per overlay selection, so later zooming by the user is not undone on every edit.
    if (widenedFor.current === overlayKey) return;
    widenedFor.current = overlayKey;
    if (!overlayKey || !editable || overlayDb.length === 0) return;
    const v = viewRef.current;
    const lo = Math.min(...overlayDb);
    const hi = Math.max(...overlayDb);
    if (lo >= viewDbMin(v) && hi <= viewDbMax(v)) return;
    const needed = Math.max(Math.abs(hi - v.center), Math.abs(lo - v.center)) * 1.05;
    const halfSpan = HALF_SPAN_NOTCHES.find((n) => n >= needed) ?? VIEW_HALF_SPAN_MAX;
    if (halfSpan > v.halfSpan) setView(clampView({ center: v.center, halfSpan }));
  }, [overlayKey, overlayDb, editable]);

  const drawn = useMemo(() => {
    const n = thumb ? 60 : 260;
    const includePreamp = thumb;
    const g = thumb ? DEFAULT_GEOM : geom;
    const fx = thumb ? (f: number) => ratioFromFreq(f) * 100 : (f: number) => freqX(f, g);
    const main = sampleCurve(profile, n, includePreamp);
    const cmp = !thumb && compare ? sampleCurve(compare.profile, 260, false) : null;
    const plotRange = thumb ? autoRange : plotView.halfSpan;
    const plotCenter = thumb ? 0 : plotView.center;
    const viewForY: GraphView = { center: plotCenter, halfSpan: plotRange };
    const fy = thumb
      ? (d: number) => thumbPlotY(d, plotRange)
      : (d: number) => mainPlotY(d, viewForY, g);
    const bandPeak = sampleCurve(profile, 260, false).peak;
    return {
      path: toPath(main.f, main.db, fx, fy),
      peak: main.peak,
      bandPeak,
      ticks: thumb ? graphDbTicks(plotRange) : ticksFor(plotView),
      overlayPaths: overlay
        ? {
            original: overlay.original ? toPath(overlay.f, overlay.original, (f) => freqX(f, g), (d) => mainPlotY(d, viewForY, g)) : null,
            equalized: overlay.equalized ? toPath(overlay.f, overlay.equalized, (f) => freqX(f, g), (d) => mainPlotY(d, viewForY, g)) : null,
            targets: overlay.targets.map((t) => ({ id: t.id, name: t.name, d: toPath(overlay.f, t.db, (f) => freqX(f, g), (d) => mainPlotY(d, viewForY, g)) })),
          }
        : null,
      cmpPath: cmp ? toPath(cmp.f, cmp.db, (f) => freqX(f, g), (d) => mainPlotY(d, viewForY, g)) : null,
      viewForY,
      g,
    };
  }, [profile, compare, thumb, autoRange, plotView, geom, overlay]);

  const { path, peak, bandPeak, ticks, cmpPath, overlayPaths, viewForY, g } = drawn;
  const allHandles = !thumb && editable ? bandHandles(profile, plotView, geom) : [];
  const handles = editable
    ? allHandles.filter((h) => !isUnused(h.band) || editable.selected === h.index)
    : allHandles;
  const cap = editable?.cap;

  const bandPaths = useMemo(() => {
    if (thumb || !editable) return [] as { index: number; d: string; selected: boolean }[];
    const f = logFrequencies(BAND_SAMPLES);
    const g = geom;
    const viewForY = { center: plotView.center, halfSpan: plotView.halfSpan };
    const fy = (d: number) => mainPlotY(d, viewForY, g);
    const fx = (hz: number) => freqX(hz, g);
    return profile.bands
      .map((b, index) => {
        if (isUnused(b) && editable.selected !== index) return null;
        const db = bandResponseDb({ ...b, enabled: true }, f);
        return { index, d: toPath(f, db, fx, fy), selected: editable.selected === index };
      })
      .filter((x): x is { index: number; d: string; selected: boolean } => x !== null);
  }, [profile, geom, plotView, editable, thumb]);

  const labelOffsets = useMemo(() => stackHandleLabels(handles, geom), [handles, geom]);

  const resetView = useCallback(() => {
    setView(defaultView(editable?.cap.gain));
  }, [editable?.cap.gain]);

  const applyDrag = useCallback(
    (drag: DragState, px: number, py: number, v: GraphView, keys: { shift: boolean; alt: boolean }) => {
      if (!cap || !editable) return;
      let d = drag;
      const band0 = profile.bands[drag.index];
      if (!band0) return;

      const handlePx = px + d.grabOffsetX;
      const handlePy = py + d.grabOffsetY;

      if (keys.alt !== d.fine || keys.shift !== d.shift) {
        d = {
          ...d,
          fine: keys.alt,
          shift: keys.shift,
          anchorPx: handlePx,
          anchorPy: handlePy,
          anchorFreq: band0.freq,
          anchorGain: band0.gain,
        };
        dragRef.current = d;
      }

      let effPx = handlePx;
      let effPy = handlePy;
      if (d.fine) {
        effPx = d.anchorPx + (handlePx - d.anchorPx) * 0.2;
        effPy = d.anchorPy + (handlePy - d.anchorPy) * 0.2;
      }

      let axisLock = d.axisLock;
      if (keys.shift && axisLock === null && Math.hypot(px - d.startPx, py - d.startPy) >= AXIS_LOCK_PX) {
        axisLock = Math.abs(px - d.startPx) >= Math.abs(py - d.startPy) ? 'x' : 'y';
        d = { ...d, axisLock };
        dragRef.current = d;
      }

      const band = profile.bands[d.index];
      if (!band) return;
      let snapped: EqBand;
      if (axisLock === 'x') {
        const freq = freqFromRatio((clampPlotX(effPx, geom) - geom.L) / geom.PW);
        snapped = snapBand(band, { freq, enabled: true }, cap);
      } else if (axisLock === 'y') {
        const cursorDb = plotDbFromY(clampPlotY(effPy, geom), v, geom);
        const gain = dragGain(cursorDb, profile, d.index, band.freq);
        snapped = snapBand(band, { freq: band.freq, gain, enabled: true }, cap);
      } else {
        const freq = freqFromRatio((clampPlotX(effPx, geom) - geom.L) / geom.PW);
        const cursorDb = plotDbFromY(clampPlotY(effPy, geom), v, geom);
        const gain = dragGain(cursorDb, profile, d.index, freq);
        snapped = snapBand(band, { freq, gain, enabled: true }, cap);
      }
      const rawGain = snapped.gain;
      if (rawGain >= cap.gain.max) setLimitHint(`max +${cap.gain.max} dB`);
      else if (rawGain <= cap.gain.min) setLimitHint(`min ${cap.gain.min} dB`);
      else setLimitHint(null);
      editable.onChange(d.index, snapped, { skipPush: true });
    },
    [cap, editable, profile, geom],
  );

  const bandFullNotice = useCallback(() => {
    const max = cap ? maxBandCount(cap, profile) : profile.bands.length;
    onNotice?.(`All ${max} bands are in use. Delete one first.`);
  }, [cap, profile, onNotice]);

  const curveYAt = useCallback(
    (px: number, v: GraphView) => {
      const cx = clampPlotX(px, geom);
      const freq = freqFromRatio((cx - geom.L) / geom.PW);
      const curveDb = profileResponseDb(profile, [freq], 48000, false)[0] as number;
      return { freq, curveY: mainPlotY(curveDb, v, geom) };
    },
    [profile, geom],
  );

  const startCreateDrag = useCallback(
    (create: CreateState, px: number, py: number, e: PointerEvent<SVGSVGElement>) => {
      if (!editable || !cap) return false;
      if (create.blocked) {
        if (!create.noticed) bandFullNotice();
        createRef.current = { ...create, noticed: true, moved: true };
        return true;
      }
      if (!editable.onAdd) return false;
      const idx = editable.onAdd(create.freq, create.gain, { skipPush: true });
      if (idx === null) {
        if (!create.noticed) bandFullNotice();
        createRef.current = { ...create, noticed: true, moved: true };
        return true;
      }
      editable.onSelect(idx);
      editable.onEditStart?.();
      dragRef.current = {
        index: idx,
        startPx: create.startPx,
        startPy: create.startPy,
        moved: true,
        axisLock: null,
        fine: e.altKey,
        shift: e.shiftKey,
        anchorPx: px,
        anchorPy: py,
        anchorFreq: create.freq,
        anchorGain: profile.bands[idx]?.gain ?? create.gain,
        overlap: [idx],
        overlapCycle: 0,
        grabOffsetX: 0,
        grabOffsetY: 0,
        editing: true,
      };
      createRef.current = null;
      setDragging(true);
      applyDrag(dragRef.current, px, py, viewRef.current, { shift: e.shiftKey, alt: e.altKey });
      return true;
    },
    [applyDrag, bandFullNotice, cap, editable, profile.bands],
  );

  const updateHover = (px: number, py: number) => {
    if (!editable || thumb) return;
    const pts = handleHitPoints(handles, geom);
    setHoverBand(nearestBand(pts, px, py, hitR));
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!editable || thumb || e.button !== 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const { x: px, y: py } = clientToSvg(svg, e.clientX, e.clientY);
    pointerRef.current = { x: px, y: py };
    const pts = handleHitPoints(handles, geom);
    const hit = nearestBand(pts, px, py, hitR);
    if (hit !== null) {
      e.preventDefault();
      safePointerCapture(svg, e.pointerId);
      const overlap = handlesInRadius(handles, geom, px, py, hitR);
      const pt = pts[hit]!;
      dragRef.current = {
        index: hit,
        startPx: px,
        startPy: py,
        moved: false,
        axisLock: null,
        fine: e.altKey,
        shift: e.shiftKey,
        anchorPx: pt.x,
        anchorPy: pt.y,
        anchorFreq: profile.bands[hit]?.freq ?? 1000,
        anchorGain: profile.bands[hit]?.gain ?? 0,
        overlap,
        overlapCycle: overlap.indexOf(hit),
        grabOffsetX: pt.x - px,
        grabOffsetY: pt.y - py,
        editing: false,
      };
      setLimitHint(null);
      editable.onSelect(hit);
      return;
    }
    if (inPlot(px, py, geom)) {
      const { freq, curveY } = curveYAt(px, viewRef.current);
      if (nearCurve(py, curveY, CURVE_CREATE_TOL)) {
        e.preventDefault();
        safePointerCapture(svg, e.pointerId);
        const cursorDb = plotDbFromY(py, viewRef.current, geom);
        const gain = gainAtCursor(cursorDb, profile, freq);
        createRef.current = {
          startPx: px,
          startPy: py,
          freq,
          gain,
          moved: false,
          noticed: false,
          blocked: cap ? bandsAtCap(profile, cap) : false,
        };
        return;
      }
      panRef.current = { startY: py, startCenter: viewRef.current.center, moved: false };
      safePointerCapture(svg, e.pointerId);
    }
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const { x: px, y: py } = clientToSvg(svg, e.clientX, e.clientY);
    pointerRef.current = { x: px, y: py };

    const create = createRef.current;
    if (create) {
      const dist = Math.hypot(px - create.startPx, py - create.startPy);
      if (dist > DRAG_THRESHOLD_PX && !create.moved) startCreateDrag(create, px, py, e);
      return;
    }

    const drag = dragRef.current;
    if (drag) {
      const dist = Math.hypot(px - drag.startPx, py - drag.startPy);
      if (dist > DRAG_THRESHOLD_PX) drag.moved = true;
      if (!drag.editing && dist > DRAG_THRESHOLD_PX) {
        const band = profile.bands[drag.index];
        const handlePx = px + drag.grabOffsetX;
        const handlePy = py + drag.grabOffsetY;
        dragRef.current = {
          ...drag,
          editing: true,
          moved: true,
          anchorPx: handlePx,
          anchorPy: handlePy,
          anchorFreq: band?.freq ?? drag.anchorFreq,
          anchorGain: band?.gain ?? drag.anchorGain,
          fine: e.altKey,
          shift: e.shiftKey,
        };
        setDragging(true);
        editable?.onEditStart?.();
      }
      const active = dragRef.current;
      if (!active?.editing) return;
      let v = viewRef.current;
      if (py < geom.T + EDGE_PAN_PX) {
        v = panView(v, EDGE_PAN_DB);
        setView(v);
      } else if (py > geom.T + geom.PH - EDGE_PAN_PX) {
        v = panView(v, -EDGE_PAN_DB);
        setView(v);
      }
      applyDrag(active, px, py, v, { shift: e.shiftKey, alt: e.altKey });
      return;
    }

    const pan = panRef.current;
    if (pan) {
      const dy = py - pan.startY;
      if (Math.abs(dy) > 2) {
        pan.moved = true;
        setPanning(true);
        const deltaDb = (dy / (geom.PH / 2)) * viewRef.current.halfSpan;
        setView(panView({ center: pan.startCenter, halfSpan: viewRef.current.halfSpan }, deltaDb));
      }
      return;
    }

    updateHover(px, py);
  };

  const endPointer = (e: PointerEvent<SVGSVGElement>) => {
    const create = createRef.current;
    if (create && !create.moved && editable) editable.onSelect(null);
    createRef.current = null;

    const pan = panRef.current;
    if (pan && !pan.moved && editable) editable.onSelect(null);
    panRef.current = null;
    setPanning(false);

    if (dragRef.current) {
      const drag = dragRef.current;
      if (
        !drag.moved &&
        drag.overlap.length > 1 &&
        drag.index === editable?.selected
      ) {
        const pos = (drag.overlapCycle + 1) % drag.overlap.length;
        const next = drag.overlap[pos] as number;
        editable?.onSelect(next);
      }
      dragRef.current = null;
      setDragging(false);
      setLimitHint(null);
      if (drag.editing) editable?.onEditEnd?.();
    }
    if (svgRef.current) safePointerRelease(svgRef.current, e.pointerId);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !editable || thumb) return;
    const onWheel = (e: WheelEvent) => {
      const { editable: ed, profile: prof, hover, view: v0 } = wheelCtx.current;
      if (!ed) return;

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const pt = pointerRef.current;
        const anchorDb = plotDbFromY(clampPlotY(pt.y, geom), v0, geom);
        zoomAccum.current += e.deltaY;
        const stepZoom = (zoomOut: boolean) => {
          setView((v) => zoomViewNotch(v, zoomOut, anchorDb));
        };
        let applied = false;
        while (Math.abs(zoomAccum.current) >= ZOOM_ACCUM_THRESHOLD) {
          stepZoom(zoomAccum.current > 0);
          zoomAccum.current += zoomAccum.current > 0 ? -ZOOM_ACCUM_THRESHOLD : ZOOM_ACCUM_THRESHOLD;
          applied = true;
        }
        if (!applied && Math.abs(e.deltaY) >= 1) stepZoom(e.deltaY > 0);
        return;
      }

      const target = hover ?? ed.selected;
      if (target === null) return;
      e.preventDefault();
      const band = prof.bands[target];
      if (!band) return;
      ed.onChange(target, snapBand(band, { q: wheelQ(band.q, e.deltaY, e.shiftKey, ed.cap) }, ed.cap), {
        coalesceKey: `wheel:${target}`,
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [!!editable, thumb, geom]);

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!editable || !cap) return;
    setHoverBand(null);
    const sel = editable.selected;
    if (e.key === 'Escape') {
      editable.onSelect(null);
      e.preventDefault();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (sel === null || !editable.onDelete) return;
      e.preventDefault();
      editable.onDelete(sel);
      editable.onSelect(null);
      return;
    }
    const digit = e.key >= '1' && e.key <= '9' ? Number(e.key) - 1 : e.key === '0' ? 9 : null;
    if (digit !== null && digit < profile.bands.length) {
      editable.onSelect(digit);
      e.preventDefault();
      return;
    }
    if (sel === null) return;
    const band = profile.bands[sel];
    if (!band) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      editable.onChange(sel, snapBand(band, { freq: nudgeFreq(band.freq, dir, e.shiftKey, cap) }, cap), {
        coalesceKey: `key:${sel}:${e.key}`,
      });
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      editable.onChange(
        sel,
        snapBand(
          band,
          { gain: stepValue(band.gain, cap.step.gain, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey, cap.gain) },
          cap,
        ),
        { coalesceKey: `key:${sel}:${e.key}` },
      );
      return;
    }
    if (e.key === '[' || e.key === ']') {
      e.preventDefault();
      const down = e.key === '[';
      const deltaY = down ? 100 : -100;
      editable.onChange(sel, snapBand(band, { q: wheelQ(band.q, deltaY, e.shiftKey, cap) }, cap), {
        coalesceKey: `key:${sel}:${e.key}`,
      });
      return;
    }
    const types = editable.filterTypes;
    if (types) {
      const map: Record<string, FilterType> = { p: 'PK', l: 'LSC', h: 'HSC' };
      const t = map[e.key.toLowerCase()];
      if (t && types.includes(t)) {
        e.preventDefault();
        editable.onChange(sel, snapBand(band, { type: t }, cap), { coalesceKey: `key:${sel}:${e.key}` });
      }
    }
  };

  const onPlotDoubleClick = (e: MouseEvent) => {
    if (!editable || thumb || !cap) return;
    const svg = svgRef.current;
    if (!svg) {
      resetView();
      return;
    }
    const { x: px, y: py } = clientToSvg(svg, e.clientX, e.clientY);
    if (inPlot(px, py, geom)) {
      const cx = clampPlotX(px, geom);
      const freq = freqFromRatio((cx - geom.L) / geom.PW);
      const curveDb = profileResponseDb(profile, [freq], 48000, false)[0] as number;
      const curveY = mainPlotY(curveDb, viewRef.current, geom);
      if (nearCurve(py, curveY, CURVE_HIT_PX)) {
        e.preventDefault();
        e.stopPropagation();
        if (cap && bandsAtCap(profile, cap)) {
          bandFullNotice();
          return;
        }
        if (!editable.onAdd) return;
        const cursorDb = plotDbFromY(py, viewRef.current, geom);
        const gain = gainAtCursor(cursorDb, profile, freq);
        const idx = editable.onAdd(freq, gain);
        if (idx === null) bandFullNotice();
        else editable.onSelect(idx);
        return;
      }
    }
    e.preventDefault();
    resetView();
  };

  const ariaExtra = editable
    ? '. Drag band handles to edit. Scroll wheel changes Q. Arrow keys nudge frequency and gain.'
    : '';

  if (thumb) {
    return (
      <svg className="graph graph-thumb" viewBox={`0 0 100 ${THUMB_H}`} preserveAspectRatio="none" role="img" aria-label={`EQ thumbnail, peak ${peak.toFixed(1)} dB${autoRange > BASE_RANGE ? `, scale ±${autoRange} dB` : ''}`}>
        <line x1={0} x2={100} y1={24} y2={24} className="graph-zero" vectorEffect="non-scaling-stroke" />
        <path d={path} className="graph-curve" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  const clipLineDb = -profile.preamp;
  const showClip = bandPeak + profile.preamp > 0.05;
  const clipY = mainPlotY(clipLineDb, viewForY, g);
  const graphClass = `graph${editable ? ' graph-editable' : ''}${dragging ? ' graph-grabbing' : ''}${panning ? ' graph-panning' : ''}`;
  const scaleText = scaleLabel(plotView);

  const svgBody = (
    <svg
      ref={svgRef}
      className={graphClass}
      width={geom.W}
      height={geom.H}
      viewBox={`0 0 ${geom.W} ${geom.H}`}
      role="img"
      tabIndex={editable ? 0 : undefined}
      aria-label={`EQ response, peak ${bandPeak.toFixed(1)} dB, scale ${scaleText}${compare ? `, compared with ${compare.label}` : ''}${measurement ? `, measurement ${measurement.label}` : ''}${targets && targets.length ? `, targets ${targets.map((t) => t.name).join(', ')}` : ''}${ariaExtra}`}
      aria-describedby={hintId}
      onPointerDown={editable ? onPointerDown : undefined}
      onPointerMove={editable ? onPointerMove : undefined}
      onPointerUp={editable ? endPointer : undefined}
      onPointerCancel={editable ? endPointer : undefined}
      onKeyDown={editable ? onKeyDown : undefined}
      onPointerLeave={editable ? () => setHoverBand(null) : undefined}
      onDoubleClick={editable ? onPlotDoubleClick : undefined}
    >
      <defs>
        <clipPath id={plotClipId}>
          <rect x={geom.L} y={geom.T} width={geom.PW} height={geom.PH} />
        </clipPath>
      </defs>
      <rect
        x={geom.L}
        y={geom.T}
        width={geom.PW}
        height={geom.PH}
        fill="transparent"
        onDoubleClick={editable ? onPlotDoubleClick : undefined}
      />
      {REGIONS.map((r, i) => {
        const x0 = freqX(r.from, geom);
        const x1 = freqX(r.to, geom);
        const rw = x1 - x0;
        const labelNeed = Math.max(r.name.length, r.range.length) * REGION_CHAR_PX + 4;
        const showLabels = rw >= labelNeed;
        return (
        <g key={r.name}>
          <title>{`${r.title} ${r.range} Hz`}</title>
          <rect x={x0} y={geom.T} width={rw} height={geom.PH} className={i % 2 ? 'region region-b' : 'region'} />
          {showLabels && <text x={(x0 + x1) / 2} y={geom.T - 22} className="graph-region" textAnchor="middle">{r.name}</text>}
          {showLabels && <text x={(x0 + x1) / 2} y={geom.T - 8} className="graph-region graph-region-range" textAnchor="middle">{r.range}</text>}
        </g>
        );
      })}
      {ticks.map((d) => (
        <g key={d} onDoubleClick={editable ? onPlotDoubleClick : undefined}>
          <line x1={geom.L} x2={geom.W - geom.R} y1={mainPlotY(d, viewForY, geom)} y2={mainPlotY(d, viewForY, geom)} className={Math.abs(d) < 0.05 ? 'graph-zero' : 'graph-grid'} />
          <text x={geom.L - 8} y={mainPlotY(d, viewForY, geom) + 4} className={Math.abs(d) < 0.05 ? 'graph-tick graph-tick-zero' : 'graph-tick'} textAnchor="end">{formatTick(Math.round(d * 100) / 100)}</text>
        </g>
      ))}
      {FREQ_TICKS.map(([f, tickLabel]) => (
        <g key={f}>
          <line x1={freqX(f, geom)} x2={freqX(f, geom)} y1={geom.T} y2={geom.T + geom.PH} className="graph-grid" />
          <text x={freqX(f, geom)} y={geom.T + geom.PH + 18} className="graph-tick" textAnchor="middle">{tickLabel}</text>
        </g>
      ))}
      <rect x={geom.L} y={geom.T} width={geom.PW} height={geom.PH} className="graph-frame" pointerEvents="none" />
      <g clipPath={`url(#${plotClipId})`}>
        {showClip && clipY > geom.T && (
          <rect x={geom.L} y={geom.T} width={geom.PW} height={clipY - geom.T} className="graph-clip" pointerEvents="none" />
        )}
        {overlayPaths?.original && <path d={overlayPaths.original} className="graph-fr-original" pointerEvents="none" />}
        {overlayPaths?.equalized && <path d={overlayPaths.equalized} className="graph-fr-eq" pointerEvents="none" />}
        {overlayPaths?.targets.map((t, i) => (
          <path key={t.id} d={t.d} className="graph-target" strokeDasharray={TARGET_DASHES[i % TARGET_DASHES.length]} pointerEvents="none" />
        ))}
        {cmpPath && <path d={cmpPath} className="graph-curve-2" pointerEvents="none" />}
        {bandPaths.map((bp) => (
          <path
            key={bp.index}
            d={bp.d}
            className={bp.selected ? 'graph-band-curve-sel' : 'graph-band-curve'}
            pointerEvents="none"
          />
        ))}
        <path d={path} className="graph-curve" pointerEvents="none" />
        {sweep > 0 && (
          <svg key={sweep} x={geom.L} y={geom.T} width={geom.PW} height={geom.PH} overflow="hidden" aria-hidden>
            <g className="graph-sweep" style={{ '--sweep-w': `${geom.PW}px` } as CSSProperties}>
              <rect x={-60} y={0} width={60} height={geom.PH} className="graph-sweep-wash" />
              <rect x={-2} y={0} width={2} height={geom.PH} className="graph-sweep-line" />
            </g>
          </svg>
        )}
      </g>
      <text x={geom.L + 10} y={geom.T + 18} className="graph-readout" pointerEvents="none">
        {`Preamp ${profile.preamp >= 0 ? '+' : ''}${profile.preamp.toFixed(1)} dB · Peak ${bandPeak >= 0 ? '+' : ''}${bandPeak.toFixed(1)} dB`}
      </text>
      {!panning && (() => {
        const tipIdx = hoverBand !== null ? hoverBand : editable?.selected ?? null;
        if (tipIdx === null) return null;
        const h = handles.find((x) => x.index === tipIdx);
        const b = profile.bands[tipIdx];
        if (!h || !b) return null;
        const drawY = h.offScreen === 'top' ? geom.T + 12 : h.offScreen === 'bottom' ? geom.T + geom.PH - 12 : h.y;
        const lo = labelOffsets.get(tipIdx) ?? 0;
        return (
          <BandTipBox
            text={formatBandTip(tipIdx, b)}
            anchorX={h.x}
            anchorY={drawY + lo}
            geom={geom}
          />
        );
      })()}
      {handles.map((h) => {
        const i = h.index;
        const s = coarse ? HANDLE_SIZE * HANDLE_SCALE_COARSE : HANDLE_SIZE;
        const selected = editable?.selected === i;
        const off = !h.band.enabled || h.band.gain === 0;
        const cls = `graph-handle${selected ? ' graph-handle-selected' : ''}${off ? ' graph-handle-off' : ''}`;
        const drawY = h.offScreen === 'top' ? geom.T + 12 : h.offScreen === 'bottom' ? geom.T + geom.PH - 12 : h.y;
        const chevron = h.offScreen === 'top' ? `M${h.x},${drawY - 4} L${h.x - 5},${drawY + 3} L${h.x + 5},${drawY + 3} Z` : h.offScreen === 'bottom' ? `M${h.x},${drawY + 4} L${h.x - 5},${drawY - 3} L${h.x + 5},${drawY - 3} Z` : null;
        return (
          <g key={i} className={cls} pointerEvents="none">
            {chevron ? <path d={chevron} className="graph-handle-shape" /> : (
              <polygon points={`${h.x},${h.y - s} ${h.x + s},${h.y} ${h.x},${h.y + s} ${h.x - s},${h.y}`} className="graph-handle-shape" />
            )}
            <text x={h.x} y={drawY - s - 4 + (labelOffsets.get(i) ?? 0)} className="graph-handle-label" textAnchor="middle">
              {String(i + 1).padStart(2, '0')}
            </text>
            {limitHint && dragging && selected && (
              <text x={h.x} y={drawY + s + 14} className="graph-limit-hint" textAnchor="middle">{limitHint}</text>
            )}
          </g>
        );
      })}
      {(compare || overlayPaths) && (() => {
        const entries: { name: string; cls: string; dash?: string }[] = [{ name: label, cls: 'graph-curve' }];
        if (overlayPaths?.original) entries.push({ name: 'Original', cls: 'graph-fr-original' }, { name: 'Equalized', cls: 'graph-fr-eq' });
        overlayPaths?.targets.forEach((t, i) => entries.push({ name: t.name, cls: 'graph-target', dash: TARGET_DASHES[i % TARGET_DASHES.length] }));
        if (compare) entries.push({ name: compare.label, cls: 'graph-curve-2' });
        return (
          <g className="graph-legend" pointerEvents="none">
            {entries.map((e, i) => (
              <g key={i} transform={`translate(${geom.W - geom.R - 150} ${geom.T + 16 + i * 18})`}>
                <line x1={0} x2={22} y1={0} y2={0} className={e.cls} strokeDasharray={e.dash} />
                <text x={28} y={4} className="graph-legend-text">{e.name.length > 18 ? `${e.name.slice(0, 17)}…` : e.name}</text>
              </g>
            ))}
          </g>
        );
      })()}
      <text x={geom.L + geom.PW / 2} y={geom.H - 8} className="graph-axis" textAnchor="middle">Frequency (Hz)</text>
      <text transform={`translate(14 ${geom.T + geom.PH / 2}) rotate(-90)`} className="graph-axis" textAnchor="middle">Gain (dB)</text>
    </svg>
  );

  return (
    <div ref={wrapRef} className="graph-wrap">
      {svgBody}
    </div>
  );
}
