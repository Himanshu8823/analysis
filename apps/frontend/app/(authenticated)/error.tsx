'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- top-level error boundary logs
    console.error('Authenticated route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-base">
      <div className="w-full max-w-md space-y-base">
        <div className="flex flex-col items-center gap-sm text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-strong">
            <AlertCircle className="h-6 w-6 text-semantic-down" aria-hidden />
          </span>
          <h1 className="font-display text-title-lg text-ink">Something went wrong</h1>
          <p className="text-body-sm text-body">
            We hit an unexpected error rendering this page. You can try again, or head back
            to the dashboard.
          </p>
        </div>
        <ErrorBanner
          message={error.message || 'Unknown error'}
          retry={reset}
        />
      </div>
    </div>
  );
}