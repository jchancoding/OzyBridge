import { useState } from 'react';
import { connectFiio } from './devices/fiio/adapter';
import { FIIO_MODELS, findFiioModel, pickFiioInterface } from './devices/fiio/models';
import { connectWalkplay } from './devices/walkplay/adapter';
import { WALKPLAY_MODELS, findWalkplayModel, pickWalkplayInterface } from './devices/walkplay/models';
import type { DeviceAdapter } from './devices/types';
import { isWebHidSupported, requestConnectDevices } from './transport/webhid';
import { Bench } from './ui/Bench';
import { describeConnectError } from './ui/connectMessages';
import { Footer } from './ui/Footer';
import { Mascot } from './ui/Mascot';
import './ui/mascot.css';
import { Probe } from './ui/Probe';
import { deviceReportUrl } from './ui/reportLink';
import { decodeShareFragment } from './core/shareLink';
import { Stripes, Workspace } from './ui/Workspace';

const UNTESTED_NOTE = 'Untested models use settings from devicePEQ hardware captures. Every write is read back and checked, but nobody has confirmed them with OzyBridge yet.';
const WALKPLAY_NOTE = 'MOONDROP Marigold can be read. Writes stay off until someone confirms a save on the hardware.';
const disconnectedText = (name: string) => `${name} disconnected. Plug it back in and click Connect. Chrome forgets the permission when the device is unplugged.`;

export function App() {
  const [adapter, setAdapter] = useState<DeviceAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState<string | null>(null);
  const sharedLink = location.hash.startsWith('#eq=') ? decodeShareFragment(location.hash) : null;

  const attach = async (a: DeviceAdapter, name: string) => {
    a.onDisconnect(() => {
      setAdapter(null);
      setError(null);
      setDisconnected(name);
    });
    setDisconnected(null);
    setAdapter(a);
  };

  const attachFiio = async (device: Parameters<typeof connectFiio>[0]) => {
    const a = await connectFiio(device);
    const name = findFiioModel(a.info.vendorId, a.info.productId)?.name ?? 'your device';
    await attach(a, name);
  };

  const attachWalkplayDevice = async (device: Parameters<typeof connectWalkplay>[0]) => {
    const a = await connectWalkplay(device);
    const name = findWalkplayModel(a.info.vendorId, a.info.productId)?.name ?? 'your device';
    await attach(a, name);
  };

  if (!isWebHidSupported()) {
    return (
      <main className="app">
        <p className="message">OzyBridge needs Chrome or Edge on desktop (WebHID).</p>
      </main>
    );
  }

  const params = new URLSearchParams(location.search);
  if (params.has('bench')) return <Bench />;
  if (params.has('probe')) return <Probe />;

  const connect = async () => {
    setError(null);
    try {
      const granted = await requestConnectDevices();
      const walkplay = pickWalkplayInterface(granted);
      if (walkplay) return void (await attachWalkplayDevice(walkplay));
      const device = pickFiioInterface(granted);
      if (!device) {
        return setError('No supported device was selected. Pick the control entry for your DAC.');
      }
      await attachFiio(device);
    } catch (e) {
      setError(describeConnectError(e));
    }
  };

  if (adapter) {
    const walkplay = findWalkplayModel(adapter.info.vendorId, adapter.info.productId);
    const model = findFiioModel(adapter.info.vendorId, adapter.info.productId) ?? walkplay;
    return (
      <>
        <main className="app screen">
          {model?.untested && (
            <aside className="untested-banner">
              <p>{walkplay ? WALKPLAY_NOTE : UNTESTED_NOTE}</p>
              <a
                href={deviceReportUrl({ name: model.name, productId: model.productId, firmware: adapter.info.firmware })}
                target="_blank"
                rel="noopener"
              >
                Report how it went
              </a>
            </aside>
          )}
          <Workspace adapter={adapter} />
          <Footer />
        </main>
        <Mascot />
      </>
    );
  }

  return (
    <>
      <main className="app screen">
        <Stripes />
        <h1 className="display">OzyBridge</h1>
        <p className="message">Control your DAC&apos;s EQ from the browser. Close FiiO Control first, then connect.</p>
        {sharedLink?.ok && (
          <p className="message">
            This link is the EQ &ldquo;{sharedLink.name}&rdquo;. Connect, and it will be previewed on screen and you choose which slot to write it to. Nothing is sent to the device until you confirm.
          </p>
        )}
        {sharedLink && !sharedLink.ok && <p className="message error">{sharedLink.errors[0]}</p>}
        <section className="supported-devices" aria-labelledby="supported-devices-heading">
          <h2 id="supported-devices-heading" className="supported-devices__heading">Supported devices</h2>
          <ul className="supported-devices__list">
            {[...FIIO_MODELS, ...WALKPLAY_MODELS].map((model) => (
              <li key={`${model.name}-${model.productId}`}>{model.name}{model.untested ? ' (untested)' : ''}</li>
            ))}
          </ul>
          <p className="supported-devices__note">{UNTESTED_NOTE} {WALKPLAY_NOTE}</p>
          <p className="supported-devices__probe">
            Have another FiiO device? Run the read-only <a href="?probe">device probe</a> and send us the report.
          </p>
        </section>
        {disconnected && <p className="message">{disconnectedText(disconnected)}</p>}
        <button className="btn-primary" onClick={connect}>CONNECT</button>
        {error && <p className="message error">{error}</p>}
        <Footer />
      </main>
      <Mascot />
    </>
  );
}
