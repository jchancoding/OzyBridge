import { useMotionPref, useThemePref, type ThemePref } from './prefs';
import { FORMSUBMIT_ID } from './submit';

const font = (file: string) => `${import.meta.env.BASE_URL}fonts/${file}`;

const OPTIONS: { pref: ThemePref; label: string }[] = [
  { pref: 'system', label: 'AUTO' },
  { pref: 'light', label: 'LIGHT' },
  { pref: 'dark', label: 'DARK' },
];

export function Footer() {
  const [pref, setPref] = useThemePref();
  const [motion, setMotion] = useMotionPref();
  return (
    <footer className="site-footer">
      <div className="theme-row">
        <span className="label">THEME</span>
        <div role="group" aria-label="Theme" className="theme-group">
          {OPTIONS.map((o) => (
            <button key={o.pref} type="button" className="btn-secondary" aria-pressed={pref === o.pref} onClick={() => setPref(o.pref)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="theme-row">
        <span className="label">MOTION</span>
        <div role="group" aria-label="Motion" className="theme-group">
          {(['on', 'off'] as const).map((m) => (
            <button key={m} type="button" className="btn-secondary" aria-pressed={motion === m} onClick={() => setMotion(m)}>
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {FORMSUBMIT_ID && (
        <p className="site-footer__support">
          <a href="?feedback">Send us suggestions, questions or feedback!</a>
        </p>
      )}
      <p className="site-footer__support">
        <a href="https://paypal.me/ozybridge" target="_blank" rel="noopener noreferrer">
          <span aria-hidden="true">☕</span> Support OzyBridge <span aria-hidden="true">❤️</span>
        </a>
      </p>
      <p>
        Fonts: <a href={font('OFL-Inter.txt')}>Inter</a>, <a href={font('OFL-JetBrainsMono.txt')}>JetBrains Mono</a> and{' '}
        <a href={font('OFL-Michroma.txt')}>Michroma</a>, under the SIL Open Font License 1.1.
        {' · '}Device protocol knowledge in part from{' '}
        <a href="https://github.com/jeromeof/devicePEQ" target="_blank" rel="noopener noreferrer">devicePEQ</a> (0BSD).
      </p>
      <p>
        Not affiliated with or endorsed by FiiO or any other manufacturer. Product names are trademarks of their owners.
        Provided as is, without warranty. Writing EQ changes settings on your device; use at your own risk.
        Runs entirely in your browser. No account, and your EQ data stays on your device unless you send a device report. Page visits are counted
        anonymously with GoatCounter, without cookies.
      </p>
    </footer>
  );
}
