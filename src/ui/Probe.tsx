import { useEffect } from 'react';
import { Verify } from './Verify';

export function Probe() {
  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.delete('probe');
    url.searchParams.set('verify', '');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, []);

  return <Verify />;
}
