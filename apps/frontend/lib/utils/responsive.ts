'use client';

import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const MOBILE_MAX = 767;
const TABLET_MAX = 1023;

function detectBreakpoint(width: number): Breakpoint {
  if (width <= MOBILE_MAX) return 'mobile';
  if (width <= TABLET_MAX) return 'tablet';
  return 'desktop';
}

/**
 * Returns the active Coinbase breakpoint. Defaults to 'desktop' during SSR
 * (window is undefined) to avoid hydration mismatches.
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');

  useEffect(() => {
    const update = () => setBreakpoint(detectBreakpoint(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return breakpoint;
}

export function isMobile(bp: Breakpoint): boolean {
  return bp === 'mobile';
}

export function isTablet(bp: Breakpoint): boolean {
  return bp === 'tablet';
}

export function isDesktop(bp: Breakpoint): boolean {
  return bp === 'desktop';
}