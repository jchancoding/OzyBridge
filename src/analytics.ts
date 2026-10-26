const ENDPOINT = 'https://ozybridge.goatcounter.com/count';

// Page-view count only: path and referrer, no cookies, never device or EQ data.
export function countPageView(): void {
  if (!import.meta.env.PROD || navigator.doNotTrack === '1') return;
  const tool = ['probe', 'bench'].find((k) => new URLSearchParams(location.search).has(k));
  const params = new URLSearchParams({
    p: location.pathname + (tool ? `?${tool}` : ''),
    r: document.referrer,
    rnd: String(Math.random()),
  });
  navigator.sendBeacon?.(`${ENDPOINT}?${params}`);
}
