import { useState } from 'react';
import { connectFiio } from './devices/fiio/adapter';
import { pickFiioInterface } from './devices/fiio/models';
import type { DeviceAdapter } from './devices/types';
import { isWebHidSupported, requestFiioDevices } from './transport/webhid';
import { Bench } from './ui/Bench';
import { describeConnectError } from './ui/connectMessages';
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

  if (new URLSearchParams(location.search).has('bench')) return <Bench />;

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

  if (adapter) return <main className="app screen"><Workspace adapter={adapter} /></main>;

  return (
    <main className="app screen">
      <Stripes />
      <h1 className="display">OzyBridge</h1>
      <p className="message">Control your FiiO BTR17 EQ from the browser. Close FiiO Control first, then connect.</p>
      {disconnected && <p className="message">{DISCONNECTED}</p>}
      <button className="btn-primary" onClick={connect}>CONNECT</button>
      {error && <p className="message error">{error}</p>}
    </main>
  );
}
