const font = (file: string) => `${import.meta.env.BASE_URL}fonts/${file}`;

export function Footer() {
  return (
    <footer className="site-footer">
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
        Runs entirely in your browser. No account, and your EQ data never leaves your device. Page visits are counted
        anonymously with GoatCounter, without cookies.
      </p>
    </footer>
  );
}
