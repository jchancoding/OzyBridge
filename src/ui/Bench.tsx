import { useState } from 'react';
import a2000 from '../core/__fixtures__/autoeq-a2000-10band.txt?raw';
import { exportAutoEq, parseAutoEq } from '../core/autoeq';
import type { EqProfile } from '../core/eq';
import { exportFiioXml } from '../core/fiioXml';
import { fitProfile } from '../core/fit';
import { connectFiio, DEFAULT_FIIO_TIMING, type FiioAdapter } from '../devices/fiio/adapter';
import { pickFiioInterface } from '../devices/fiio/models';
import { WriteVerifyError } from '../devices/types';
import { requestFiioDevices } from '../transport/webhid';

const TEST_SLOT = 169;
const BACKUP_KEY = 'ozy-bench-user10-backup';

function hex(b: Uint8Array): string {
  const framed = (b[0] === 0xaa || b[0] === 0xbb) && b.length >= 8 && b[7 + (b[5] ?? 0)] === 0xee;
  let len = framed ? 8 + (b[5] ?? 0) : b.length;
  if (!framed) while (len > 1 && b[len - 1] === 0) len--;
  return [...b.subarray(0, len)].map((x) => x.toString(16).padStart(2, '0')).join(' ').toUpperCase();
}

function describeInterface(d: HIDDevice): string {
  const cols = d.collections.map((c) => {
    const ids = (kind: string, rs?: HIDReportInfo[]) =>
      rs && rs.length ? ` ${kind}[${rs.map((r) => r.reportId).join(',')}]` : '';
    const page = `0x${(c.usagePage ?? 0).toString(16)}/0x${(c.usage ?? 0).toString(16)}`;
    return `${page}${ids('in', c.inputReports)}${ids('out', c.outputReports)}${ids('feat', c.featureReports)}`;
  });
  return `"${d.productName}" ${cols.join('; ')}`;
}

function loadBackup(): EqProfile | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    return raw ? (JSON.parse(raw) as EqProfile) : null;
  } catch {
    return null;
  }
}

export function Bench() {
  const [adapter, setAdapter] = useState<FiioAdapter | null>(null);
  const [original, setOriginal] = useState<number | null>(null);
  const [backup, setBackup] = useState<EqProfile | null>(loadBackup);
  const [afterPreampMs, setAfterPreampMs] = useState(DEFAULT_FIIO_TIMING.afterPreampMs);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const say = (line: string) => {
    const t = new Date().toISOString().slice(11, 23);
    setLog((l) => [...l.slice(-499), `${t} ${line}`]);
  };
  const sayProfile = (p: EqProfile) => exportAutoEq(p).trimEnd().split('\n').forEach((l) => say(`   ${l}`));

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    say(`--- ${label}`);
    const t0 = performance.now();
    try {
      await fn();
      say(`OK ${label} (${Math.round(performance.now() - t0)} ms)`);
    } catch (e) {
      say(`FAILED ${label}: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
      if (e instanceof WriteVerifyError) {
        say('   expected:');
        sayProfile(e.expected);
        say('   read back:');
        sayProfile(e.readBack);
      }
    } finally {
      if (adapter) say(`   CRC mismatches so far: ${adapter.crcMismatches}`);
      setBusy(false);
    }
  };

  const connect = () =>
    run('Connect (reads band count and firmware)', async () => {
      const picked = await requestFiioDevices();
      const granted = [...new Set([...picked, ...(await navigator.hid.getDevices())])];
      granted.forEach((d) => say(`   interface ${describeInterface(d)}`));
      const dev = pickFiioInterface(granted);
      if (!dev) {
        throw new Error(
          picked.length === 0
            ? 'No device was picked.'
            : 'That entry is not the BTR17 control interface. Click Connect again and pick the other BTR17 entry.',
        );
      }
      const a = await connectFiio(dev, {
        timing: { afterPreampMs },
        log: (dir, bytes) => say(`${dir === 'out' ? '>>' : '<<'} ${hex(bytes)}`),
      });
      a.onDisconnect(() => {
        say('Device disconnected');
        setAdapter(null);
      });
      say(`   ${a.info.productName}, firmware ${a.info.firmware ?? 'unknown'}, afterPreampMs ${afterPreampMs}`);
      setAdapter(a);
    });

  const probe = (a: FiioAdapter) =>
    run('1. Read-only probe of the active slot', async () => {
      const id = await a.getActiveSlot();
      setOriginal(id);
      const label = a.capabilities.slots.find((s) => s.id === id)?.label ?? (id === 240 ? 'EQ off' : '?');
      say(`   active slot ${id} (${label})`);
      sayProfile(await a.readActiveProfile());
    });

  const backUp = (a: FiioAdapter) =>
    run('2. Back up USER10 (switches to it and back)', async () => {
      const p = await a.readSlot(TEST_SLOT);
      localStorage.setItem(BACKUP_KEY, JSON.stringify(p));
      setBackup(p);
      sayProfile(p);
    });

  const readUser10 = (a: FiioAdapter) =>
    run('Read USER10 (switches to it and back, keeps the backup)', async () => {
      sayProfile(await a.readSlot(TEST_SLOT));
    });

  const writeAndRestoreActive = async (a: FiioAdapter, p: EqProfile) => {
    try {
      sayProfile(await a.writeSlot(TEST_SLOT, p));
    } finally {
      if (original !== null) await a.setActiveSlot(original);
    }
  };

  const oneBand = (a: FiioAdapter, b: EqProfile) =>
    run('3. Change band 1 of USER10 to PK 1000 Hz -3 dB Q 1', () =>
      writeAndRestoreActive(a, {
        ...b,
        bands: b.bands.map((x, i) => (i === 0 ? { type: 'PK', freq: 1000, gain: -3, q: 1, enabled: true } : x)),
      }),
    );

  const fullWrite = (a: FiioAdapter) =>
    run('4. Write the A2000 AutoEQ file to USER10', async () => {
      const parsed = parseAutoEq(a2000);
      if (!parsed.ok) throw new Error(parsed.errors.map((e) => e.message).join(' '));
      const fit = fitProfile(parsed.profile, a.capabilities);
      if (!fit.ok) throw new Error(fit.errors.map((e) => e.message).join(' '));
      fit.notes.forEach((n) => say(`   note: ${n}`));
      await writeAndRestoreActive(a, fit.profile);
    });

  const restore = (a: FiioAdapter, b: EqProfile) =>
    run('5. Restore USER10 from backup', async () => {
      await writeAndRestoreActive(a, b);
      localStorage.removeItem(BACKUP_KEY);
      setBackup(null);
    });

  const downloadXml = (a: FiioAdapter) =>
    run('Download USER10 as FiiO .xml', async () => {
      const p = await a.readSlot(TEST_SLOT);
      const xml = exportFiioXml(p, { model: a.info.productName, name: 'OzyControl bench USER10' });
      const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'OzyControl bench USER10.xml';
      link.click();
      URL.revokeObjectURL(url);
    });

  const ready = adapter !== null && !busy;
  return (
    <main className="app">
      <p className="message">
        Bench check for the BTR17. Close FiiO Control first. Run the steps in order and stop at the first failure.
        Only USER10 is written, and step 5 puts it back.
      </p>
      <label className="bench-field">
        Wait after preamp (ms)
        <input
          type="number"
          min={0}
          step={100}
          value={afterPreampMs}
          disabled={adapter !== null}
          onChange={(e) => setAfterPreampMs(Number(e.target.value))}
        />
      </label>
      <div className="bench-row">
        <button className="btn-primary" disabled={busy || adapter !== null} onClick={connect}>Connect</button>
        <button className="btn-primary" disabled={!ready} onClick={() => adapter && probe(adapter)}>1. Read only</button>
        <button className="btn-primary" disabled={!ready || original === null || backup !== null} onClick={() => adapter && backUp(adapter)}>2. Back up USER10</button>
        <button className="btn-primary" disabled={!ready || original === null || !backup} onClick={() => adapter && backup && oneBand(adapter, backup)}>3. One band</button>
        <button className="btn-primary" disabled={!ready || original === null || !backup} onClick={() => adapter && fullWrite(adapter)}>4. Full write</button>
        <button className="btn-primary" disabled={!ready || original === null || !backup} onClick={() => adapter && backup && restore(adapter, backup)}>5. Restore</button>
        <button className="btn-primary" disabled={!ready} onClick={() => adapter && readUser10(adapter)}>Read USER10</button>
        <button className="btn-primary" disabled={!ready} onClick={() => adapter && downloadXml(adapter)}>Export .xml</button>
        <button className="btn-primary" disabled={log.length === 0} onClick={() => void navigator.clipboard.writeText(log.join('\n'))}>Copy log</button>
      </div>
      {backup && <p className="message">USER10 backup saved in this browser. It survives a page reload. Step 5 restores it.</p>}
      <pre className="bench-log">{log.join('\n')}</pre>
    </main>
  );
}
