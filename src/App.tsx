import { useState } from 'react';
import { isWebHidSupported, requestFiioDevice } from './transport/webhid';

export function App() {
  const [name, setName] = useState<string | null>(null);

  if (!isWebHidSupported()) {
    return (
      <main className="app">
        <p className="message">OzyControl needs Chrome or Edge on desktop (WebHID).</p>
      </main>
    );
  }

  const connect = async () => {
    const device = await requestFiioDevice();
    if (device) setName(device.productName);
  };

  return (
    <main className="app">
      <button className="btn-primary" onClick={connect}>CONNECT</button>
      {name && <p className="device-name">{name}</p>}
    </main>
  );
}
