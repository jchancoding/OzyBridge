import { useEffect, useState, type ReactNode } from 'react';
import type { FilterType } from '../core/eq';

const STORAGE_KEY = 'ozy-graph-keys';
const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform) ? '⌘' : 'Ctrl';

function loadOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveOpen(open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function Row({ k, children }: { k: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{children}</dd>
    </>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}

export function GraphKeysLegend({ filterTypes, id }: { filterTypes: FilterType[]; id: string }) {
  const [open, setOpen] = useState(loadOpen);
  const typeKeys = filterTypes
    .map((t) => (t === 'PK' ? 'P' : t === 'LSC' ? 'L' : 'H'))
    .join(' / ');
  const typeNames = filterTypes.map((t) => (t === 'PK' ? 'peak' : t === 'LSC' ? 'low shelf' : 'high shelf')).join(', ');

  useEffect(() => {
    saveOpen(open);
  }, [open]);

  return (
    <details
      id={id}
      className="graph-keys"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary>Graph shortcuts</summary>
      <div className="graph-keys-body">
        <div className="graph-keys-group">
          <p className="graph-keys-label">Mouse</p>
          <dl>
            <Row k="Drag a point">frequency and gain</Row>
            <Row k={<><Kbd>Shift</Kbd> + drag</>}>lock to one direction</Row>
            <Row k={<><Kbd>Alt</Kbd> / Option + drag</>}>fine adjust</Row>
            <Row k="Scroll on a point">Q (<Kbd>Shift</Kbd> = coarse)</Row>
            <Row k={<><Kbd>{mod}</Kbd> + scroll or pinch</>}>zoom dB scale</Row>
            <Row k="Drag empty space">pan up or down</Row>
            <Row k="Drag along the curve">create a band</Row>
            <Row k="Double-click curve">add a band</Row>
            <Row k="Double-click empty space">reset view</Row>
          </dl>
        </div>
        <div className="graph-keys-group">
          <p className="graph-keys-label">Keyboard</p>
          <dl>
            <Row k={<><Kbd>1</Kbd>–<Kbd>9</Kbd>, <Kbd>0</Kbd></>}>select band 1–10</Row>
            <Row k={<><Kbd>←</Kbd> <Kbd>→</Kbd></>}>frequency (<Kbd>Shift</Kbd> = coarse)</Row>
            <Row k={<><Kbd>↑</Kbd> <Kbd>↓</Kbd></>}>gain (<Kbd>Shift</Kbd> = 10×)</Row>
            <Row k={<><Kbd>[</Kbd> <Kbd>]</Kbd></>}>Q down / up (<Kbd>Shift</Kbd> = coarse)</Row>
            {filterTypes.length > 0 && (
              <Row k={typeKeys.split(' / ').map((k, i) => (
                <span key={k}>{i ? ' / ' : ''}<Kbd>{k}</Kbd></span>
              ))}>{typeNames} (device types only)</Row>
            )}
            <Row k={<><Kbd>Delete</Kbd> / Backspace</>}>delete band</Row>
            <Row k={<Kbd>Esc</Kbd>}>deselect</Row>
            <Row k={<><Kbd>{mod}+Z</Kbd>, <Kbd>Shift+{mod}+Z</Kbd></>}>undo, redo</Row>
          </dl>
        </div>
      </div>
      <p className="graph-keys-note">Keys work when the graph is focused (click it).</p>
    </details>
  );
}
