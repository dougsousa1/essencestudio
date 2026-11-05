import { useEffect, useState } from 'react';

export type Route = '/' | '/studio' | '/biblioteca' | '/revisao';

/** Query string inside the hash, e.g. #/revisao?projeto=/path */
export const hashParam = (k: string) => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get(k);

const read = (): Route => {
  const h = window.location.hash.replace(/^#/, '').split('?')[0] || '/';
  return h === '/studio' || h === '/biblioteca' || h === '/revisao' ? h : '/';
};

export const navigate = (to: Route) => {
  window.location.hash = to;
  window.scrollTo({ top: 0 });
};

/** Tiny hash router: #/, #/studio, #/biblioteca. */
export const useRoute = () => {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
};
