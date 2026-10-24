'use client';

import { AlertCircle } from 'lucide-react';

interface FieldErrorProps {
  message: string;
  /** Id of the input this error belongs to — links the message for screen readers. */
  id?: string;
}

/**
 * Inline validation error shown directly beneath the field it belongs to.
 *
 * Used for client-side validation (required, format). Server-side form errors
 * that are not tied to a single field stay in the form-level error banner.
 */
export function FieldError({ message, id }: FieldErrorProps) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-center gap-xs text-caption text-semantic-down"
    >
      <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden />
      {message}
    </p>
  );
}
