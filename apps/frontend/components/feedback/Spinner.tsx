'use client';

import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  className?: string;
  size?: number;
  label?: string;
}

export function Spinner({ className = '', size = 24, label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label ?? 'Loading'}
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <Loader2
        aria-hidden
        className="animate-spin text-primary"
        style={{ width: size, height: size }}
      />
      {label ? <span className="text-body-sm text-muted">{label}</span> : null}
    </span>
  );
}