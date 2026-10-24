'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle } from 'lucide-react';
import { useForgotPassword } from '@/hooks/useAuth';
import { FieldError } from '@/components/feedback/FieldError';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { mutate: requestReset, isPending } = useForgotPassword();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setEmailError(null);

    if (!email.trim()) {
      setEmailError('Enter your email address');
      return;
    }

    requestReset(email, {
      onSuccess: () => setSubmitted(true),
      onError: () =>
        setError('We could not process your request. Please try again in a moment.'),
    });
  };

  if (submitted) {
    return (
      <div className="cb-surface-card">
        <div className="mb-lg flex flex-col gap-xs">
          <span className="cb-badge">Reset link sent</span>
          <h1 className="font-display text-display-sm text-ink">Check your inbox</h1>
          <p className="text-body-sm text-body">
            If an account exists for <strong className="text-ink">{email}</strong>, we have
            sent a password reset link. The link expires in 30 minutes.
          </p>
        </div>
        <div className="flex flex-col gap-sm">
          <Link href="/login" className="cb-btn-secondary w-full">
            Return to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cb-card-elevated">
      <div className="mb-lg flex flex-col gap-xs">
        <h1 className="cb-auth-heading">Reset your password</h1>
        <p className="text-body-sm text-body">
          Enter the email address tied to your Resultiq account.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-base" noValidate>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="cb-input"
            placeholder="you@college.edu"
            aria-invalid={!!emailError}
            aria-describedby={emailError ? 'email-error' : undefined}
          />
          {emailError ? <FieldError id="email-error" message={emailError} /> : null}
        </label>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-xs rounded-md border border-hairline bg-surface-soft px-sm py-xs text-body-sm text-semantic-down"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="cb-btn-primary w-full"
        >
          {isPending ? (
            <span className="inline-flex items-center gap-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending link
            </span>
          ) : (
            'Send reset link'
          )}
        </button>

        <div className="flex flex-col gap-xs text-body-sm text-body md:flex-row md:items-center md:justify-end">
          <Link
            href="/login"
            className="cb-btn-tertiary h-11 px-0 text-body-sm"
          >
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}