import * as React from 'react';

/**
 * Tracks whether the viewport is below the tablet breakpoint (768px).
 *
 * Uses `matchMedia` rather than a resize listener so it stays in sync with
 * the CSS breakpoints defined in `tailwind.config.ts`.
 */
const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}
