import { useState } from 'react';
import { connectFiio } from './devices/fiio/adapter';
import { FIIO_MODELS, pickFiioInterface } from './devices/fiio/models';
import type { DeviceAdapter } from './devices/types';
import { isWebHidSupported, requestFiioDevices } from './transport/webhid';
import { Bench } from './ui/Bench';
import { describeConnectError } from './ui/connectMessages';
import { Footer } from './ui/Footer';
import { Probe } from './ui/Probe';
import { Stripes, Workspace } from './ui/Workspace';

const DISCONNECTED = 'BTR17 disconnected. Plug it back in and click Connect. Chrome forgets the permission when the device is unplugged.';

export function App() {
  const [adapter, setAdapter] = useState<DeviceAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState(false);

  const attach = async (device: Parameters<typeof connectFiio>[0]) => {
    const a = await connectFiio(device);
    a.onDisconnect(() => {
      setAdapter(null);
      setError(null);
      setDisconnected(true);
    });
    setDisconnected(false);
    setAdapter(a);
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
      const device = pickFiioInterface(await requestFiioDevices());
      if (!device) return setError('No supported FiiO device was selected. Pick the BTR17 control entry.');
      await attach(device);
    } catch (e) {
      setError(describeConnectError(e));
    }
  };

  if (adapter) return <main className="app screen"><Workspace adapter={adapter} /><Footer /></main>;

  return (
    <main className="app screen">
      <Stripes />
      <h1 className="display">OzyBridge</h1>
      <p className="message">Control your DAC&apos;s EQ from the browser. Close FiiO Control first, then connect.</p>
      <section className="supported-devices" aria-labelledby="supported-devices-heading">
        <h2 id="supported-devices-heading" className="supported-devices__heading">Supported devices</h2>
        <ul className="supported-devices__list">
          {FIIO_MODELS.map((model) => (
            <li key={model.productId}>{model.name}</li>
          ))}
        </ul>
        <p className="supported-devices__probe">
          Have another FiiO device? Run the read-only <a href="?probe">device probe</a> and send us the report.
        </p>
      </section>
      {disconnected && <p className="message">{DISCONNECTED}</p>}
      <button className="btn-primary" onClick={connect}>CONNECT</button>
      {error && <p className="message error">{error}</p>}
      <Footer />
    </main>
  );
}
