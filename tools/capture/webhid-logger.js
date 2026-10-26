// Paste into the DevTools console on fiiocontrol.fiio.com before connecting the device.
// Records every HID frame plus the label of each UI element clicked. Run ozyDump() to download.
(() => {
  if (window.__ozyLog) return console.log('[ozy] logger already running');
  const log = (window.__ozyLog = []);
  const t0 = performance.now();
  const hex = (buf) =>
    Array.from(new Uint8Array(buf.buffer ?? buf, buf.byteOffset ?? 0, buf.byteLength))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
  const push = (e) => log.push({ t: Math.round(performance.now() - t0), ...e });
  const watched = new WeakSet();
  const watch = (dev) => {
    if (watched.has(dev)) return;
    watched.add(dev);
    dev.addEventListener('inputreport', (ev) =>
      push({ dir: 'in', dev: dev.productName, id: ev.reportId, hex: hex(ev.data) }),
    );
  };
  const P = HIDDevice.prototype;
  for (const name of ['sendReport', 'sendFeatureReport']) {
    const orig = P[name];
    P[name] = function (id, data) {
      watch(this);
      push({ dir: name === 'sendReport' ? 'out' : 'feat-out', dev: this.productName, id, hex: hex(data) });
      return orig.call(this, id, data);
    };
  }
  const origRecv = P.receiveFeatureReport;
  P.receiveFeatureReport = async function (id) {
    const r = await origRecv.call(this, id);
    push({ dir: 'feat-in', dev: this.productName, id, hex: hex(r) });
    return r;
  };
  navigator.hid.getDevices().then((ds) => ds.forEach(watch));
  document.addEventListener(
    'click',
    (ev) => {
      const el = ev.target.closest('button,[role],label,li,a,.el-slider,.el-switch,.el-select') ?? ev.target;
      const text = (el.innerText || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ');
      push({ dir: 'ui', text: text.slice(0, 60) });
    },
    true,
  );
  document.addEventListener('change', (ev) => push({ dir: 'ui', change: String(ev.target.value).slice(0, 30) }), true);
  window.ozyDump = () => {
    const blob = new Blob([JSON.stringify(log, null, 1)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `ozy-capture-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`,
    });
    a.click();
    return `${log.length} events saved`;
  };
  console.log('[ozy] logging. Use FiiO Control normally, then run ozyDump()');
})();
