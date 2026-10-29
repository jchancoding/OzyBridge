/** True when the app is served from a developer machine (not the public GitHub Pages site). */
export function isLocalAppHost(hostname: string, viteDev: boolean): boolean {
  if (viteDev) return true;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function isLocalApp(): boolean {
  return typeof location !== 'undefined' && isLocalAppHost(location.hostname, import.meta.env.DEV);
}
