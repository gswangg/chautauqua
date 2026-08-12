import { useEffect, useState } from 'react';

const PHONE_QUERY = '(max-width: 700px)';

/** True below the 700px phone breakpoint (DEC-380). Drives AgendaPage's
 * split between the desktop drag-drop day grid and the phone tap-to-place
 * flow. Subscribes to matchMedia's `change` event so a live resize
 * re-renders the correct tree without a reload. Returns false whenever
 * `window.matchMedia` is undefined — jsdom (the test environment) does not
 * implement it, so tests keep exercising the desktop tree unless they stub
 * matchMedia themselves. */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(PHONE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(PHONE_QUERY);
    setIsPhone(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsPhone(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isPhone;
}
