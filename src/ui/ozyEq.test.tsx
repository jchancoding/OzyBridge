import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from '../App';
import { OzyEq } from './OzyEq';

const loc = { hash: '', search: '', origin: 'http://x', pathname: '/' };

const win = { matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) };
const store = { getItem: () => null, setItem: () => {} };

afterEach(() => vi.unstubAllGlobals());

describe('OzyEq', () => {
  it('renders the editor shell', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    vi.stubGlobal('location', loc);
    vi.stubGlobal('window', win);
    vi.stubGlobal('localStorage', store);
    const html = renderToStaticMarkup(<OzyEq />);
    expect(html).toContain('OzyEQ');
    expect(html).toContain('No device (10 bands)');
    expect(html).toContain('Download .txt (Squiglink / AutoEQ)');
    expect(html).toContain('Paste from clipboard');
    expect(html).toContain('EQ name');
    expect(html).toContain('Import EQ');
    expect(html).toContain('Limits your EQ settings to that specific device.');
    expect(html).not.toContain('Or paste EQ text here');
    expect(html).not.toContain('>File<');
  });
});

describe('App landing', () => {
  it('without WebHID shows the unsupported message and no connect button', () => {
    vi.stubGlobal('location', loc);
    vi.stubGlobal('window', win);
    vi.stubGlobal('localStorage', store);
    vi.stubGlobal('navigator', {});
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('This browser can&#x27;t connect to USB DACs');
    expect(html).not.toContain('CONNECT DAC');
  });
  it('with WebHID shows both buttons', () => {
    vi.stubGlobal('location', loc);
    vi.stubGlobal('window', win);
    vi.stubGlobal('localStorage', store);
    vi.stubGlobal('navigator', { hid: {} });
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('CONNECT DAC');
    expect(html).toContain('Open OZYEQ');
  });
});
