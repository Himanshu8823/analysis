'use client';

import { AlertCircle } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  retry?: () => void;
}

export function ErrorBanner({ message, retry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-sm rounded-lg border border-hairline bg-surface-soft p-base md:flex-row md:items-center md:justify-between"
    >
      <div className="flex items-start gap-sm">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-semantic-down" aria-hidden />
        <p className="text-body-sm text-ink">{message}</p>
      </div>
      {retry ? (
        <button type="button" onClick={retry} className="cb-btn-secondary w-full md:w-auto">
          Retry
        </button>
      ) : null}
    </div>
  );
}