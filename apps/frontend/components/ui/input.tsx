import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Input — DESIGN.md `components.text-input`: 1px hairline border, 12px radius,
 * 48px height, and a 2px Coinbase Blue border on focus.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-12 w-full rounded-md border border-hairline bg-canvas px-4 py-3 text-body-md text-ink transition-colors placeholder:text-muted focus-visible:border-2 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
