import { useState } from 'react';
import { connectFiio } from './devices/fiio/adapter';
import { FIIO_MODELS, findFiioModel, pickFiioInterface } from './devices/fiio/models';
import { connectWalkplay } from './devices/walkplay/adapter';
import { WALKPLAY_MODELS, findWalkplayModel, pickWalkplayInterface } from './devices/walkplay/models';
import type { DeviceAdapter } from './devices/types';
import { isWebHidSupported, requestConnectDevices } from './transport/webhid';
import { Bench } from './ui/Bench';
import { describeConnectError } from './ui/connectMessages';
import { Feedback } from './ui/Feedback';
import { Footer } from './ui/Footer';
import { Mascot } from './ui/Mascot';
import './ui/mascot.css';
import './ui/verify.css';
import { Probe } from './ui/Probe';
import { Verify } from './ui/Verify';
import { decodeShareFragment } from './core/shareLink';
import { Stripes, Workspace } from './ui/Workspace';

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
  if (params.has('verify')) return <Verify />;
  if (params.has('feedback')) return <Feedback />;

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

  const verifiedFiio = FIIO_MODELS.filter((m) => !m.untested);
  const untestedFiio = FIIO_MODELS.filter((m) => m.untested);
  const verifiedWalk = WALKPLAY_MODELS.filter((m) => !m.untested);
  const untestedWalk = WALKPLAY_MODELS.filter((m) => m.untested);

  if (adapter) {
    const walkplay = findWalkplayModel(adapter.info.vendorId, adapter.info.productId);
    const model = findFiioModel(adapter.info.vendorId, adapter.info.productId) ?? walkplay;
    return (
      <>
        <main className="app screen">
          {model?.untested && (
            <aside className="untested-banner">
              <p>
                {walkplay
                  ? 'This WalkPlay device is read-only in OzyBridge until writes are confirmed on hardware.'
                  : 'This model uses settings from devicePEQ captures. Writes are verified, but nobody has confirmed it with OzyBridge yet.'}
              </p>
              <a href="?verify">Test this device</a>
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
        <section className="intro" aria-labelledby="intro-heading">
          <h2 id="intro-heading" className="intro__heading">
            Bring your EQ to your DAC, <span className="intro__highlight">without the vendor-app friction.</span>
          </h2>
          <p>
            OzyBridge was built to replace FiiO Control&apos;s clunky EQ import and export flow. Drop in a parametric EQ
            from Squiglink, AutoEQ or PeqDB, choose a device slot, and write it straight to your USB DAC.{' '}
            <strong>No format conversion, no account, no app.</strong>
          </p>
          <p>
            Import and export standard parametric EQ files, name and compare slots, keep a preset library, and share an
            EQ with a link. Every write is read back and verified.
          </p>
          <p className="intro__note">Close your device&apos;s own app before connecting.</p>
        </section>
        {sharedLink?.ok && (
          <p className="message">
            This link is the EQ &ldquo;{sharedLink.name}&rdquo;. Connect, and it will be previewed on screen and you choose which slot to write it to. Nothing is sent to the device until you confirm.
          </p>
        )}
        {sharedLink && !sharedLink.ok && <p className="message error">{sharedLink.errors[0]}</p>}
        <section className="supported-devices" aria-labelledby="supported-devices-heading">
          <h2 id="supported-devices-heading" className="supported-devices__heading">Supported devices</h2>
          {verifiedFiio.length + verifiedWalk.length > 0 && (
            <>
              <h3 className="supported-devices__subheading">Verified</h3>
              <ul className="supported-devices__list">
                {[...verifiedFiio, ...verifiedWalk].map((model) => (
                  <li key={`${model.name}-v`}>{model.name}</li>
                ))}
              </ul>
            </>
          )}
          {(untestedFiio.length > 0 || untestedWalk.length > 0) && (
            <>
              <h3 className="supported-devices__subheading">Untested</h3>
              <ul className="supported-devices__list">
                {untestedFiio.map((model) => (
                  <li key={`${model.name}-u`}>{model.name}</li>
                ))}
                {untestedWalk.map((model) => (
                  <li key={`${model.name}-w`}>{model.name} (read-only)</li>
                ))}
              </ul>
              {untestedFiio.length > 0 && (
                <p className="supported-devices__risk">
                  Writable untested devices can be tried at your own risk. OzyBridge only sends documented EQ commands,
                  never touches firmware, and reads every write back. The realistic worst case is a wrong EQ in one slot,
                  which you can undo here or reset in the vendor app.
                </p>
              )}
            </>
          )}
          <h3 className="supported-devices__subheading">Get your device supported</h3>
          <p className="supported-devices__probe">
            Got a DAC that&apos;s untested or missing from the list? Run the{' '}
            <a href="?verify">device test</a>. It takes about two minutes, reads your EQ, tries one small change on a
            single slot, puts everything back, and sends us the result. One passing test is usually enough for us to mark
            a device as supported.
          </p>
          <p className="supported-devices__note">
            We&apos;re working hard to add more devices. Every test report speeds that up.
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
