import { FRAMES, toRuns, type FrameName } from './mascotFrames';

const NAMES = Object.keys(FRAMES) as FrameName[];

export function Mascot() {
  return (
    <div className="mascot" aria-hidden="true">
      <div className="mascot__flip">
        <svg viewBox="0 0 24 24" width="72" height="72" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
          {NAMES.map((name) => (
            <g key={name} className={`mascot__f mascot__f--${name}`}>
              {toRuns(FRAMES[name]).map((r) => (
                <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={`var(--oz-mascot-${r.c})`} />
              ))}
            </g>
          ))}
          <g className="mascot__steam">
            <rect x="19" y="7" width="1" height="1" fill="var(--oz-mascot-2)" />
            <rect x="20" y="5" width="1" height="1" fill="var(--oz-mascot-2)" />
            <rect x="19" y="3" width="1" height="1" fill="var(--oz-mascot-2)" />
          </g>
        </svg>
      </div>
    </div>
  );
}
