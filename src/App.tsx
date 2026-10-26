import { useState } from 'react';
import { pickFiioInterface } from './devices/fiio/models';
import { isWebHidSupported, requestFiioDevices } from './transport/webhid';
import { Bench } from './ui/Bench';

export function App() {
  const [name, setName] = useState<string | null>(null);

  if (!isWebHidSupported()) {
    return (
      <main className="app">
        <p className="message">OzyControl needs Chrome or Edge on desktop (WebHID).</p>
      </main>
    );
  }

  if (new URLSearchParams(location.search).has('bench')) return <Bench />;

  const connect = async () => {
    const device = pickFiioInterface(await requestFiioDevices());
    if (device) setName(device.productName);
  };

  return (
    <main className="app">
      <button className="btn-primary" onClick={connect}>CONNECT</button>
      {name && <p className="device-name">{name}</p>}
    </main>
  );
}
