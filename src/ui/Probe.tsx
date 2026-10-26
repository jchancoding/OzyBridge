import { useState } from 'react';
import { probeFiio } from '../devices/fiio/probe';
import { requestFiioDevicesAnyInterface } from '../transport/webhid';

export function Probe() {
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const pick = async () => {
    setBusy(true);
    const add = (l: string[]) => setLines((prev) => [...prev, ...l]);
    try {
      const devices = await requestFiioDevicesAnyInterface();
      if (devices.length === 0) return add(['No device was picked.']);
      if (lines.length === 0) add([`date: ${new Date().toISOString()}`, `userAgent: ${navigator.userAgent}`]);
      for (const d of devices) {
        add(['', `--- entry: ${d.productName}`]);
        add(await probeFiio(d));
      }
    } catch (e) {
      add([`FAILED ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`]);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="app">
      <h1>FiiO device probe</h1>
      <p className="message">This page only reads from your device. It changes nothing.</p>
      <ol className="message">
        <li>Close FiiO Control and other EQ apps.</li>
        <li>Plug the device in by USB.</li>
        <li>Click Pick device. If the browser lists several entries for your device, run the probe once for each entry.</li>
        <li>Click Copy report and send it to us.</li>
      </ol>
      <div className="bench-row">
        <button className="btn-primary" disabled={busy} onClick={pick}>Pick device</button>
        <button className="btn-primary" disabled={busy || lines.length === 0} onClick={copy}>{copied ? 'Copied' : 'Copy report'}</button>
        <button className="btn-primary" disabled={busy || lines.length === 0} onClick={() => setLines([])}>Clear</button>
      </div>
      <pre className="bench-log">{lines.join('\n')}</pre>
    </main>
  );
}
