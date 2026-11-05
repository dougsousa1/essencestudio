import { useEffect, useState } from 'react';

export type Route = '/' | '/studio' | '/biblioteca';

const read = (): Route => {
  const h = window.location.hash.replace(/^#/, '') || '/';
  return h === '/studio' || h === '/biblioteca' ? h : '/';
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
