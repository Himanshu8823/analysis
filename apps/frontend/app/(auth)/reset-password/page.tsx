'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useResetPassword } from '@/hooks/useAuth';
import { FieldError } from '@/components/feedback/FieldError';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';

  const { mutate: resetPassword, isPending } = useResetPassword();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPasswordError(null);
    setConfirmError(null);

    if (!token) {
      setError('This reset link is missing its token. Request a new link.');
      return;
    }

    if (!password) {
      setPasswordError('Choose a password');
      return;
    }

    if (password !== confirmPassword) {
      setConfirmError('The two passwords do not match');
      return;
    }

    resetPassword(
      { token, password },
      {
        onSuccess: () => router.push('/login'),
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string | string[] } } };
          const message = e.response?.data?.message;
          setError(
            Array.isArray(message)
              ? message.join('. ')
              : (message ?? 'We could not reset your password. The link may have expired.'),
          );
        },
      },
    );
  };

  if (!token) {
    return (
      <div className="cb-card-elevated">
        <div className="mb-lg flex flex-col gap-xs">
          <h1 className="cb-auth-heading">Invalid reset link</h1>
          <p className="text-body-sm text-body">
            This link is missing its reset token. Request a new link and try again.
          </p>
        </div>
        <Link href="/forgot-password" className="cb-btn-secondary w-full">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="cb-card-elevated">
      <div className="mb-lg flex flex-col gap-xs">
        <h1 className="cb-auth-heading">Choose a new password</h1>
        <p className="text-body-sm text-body">
          Your reset link is valid for a short time. Pick a password you have not used before.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-base" noValidate>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">New password</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="cb-input"
            placeholder="At least 8 characters"
            aria-invalid={!!passwordError}
            aria-describedby={passwordError ? 'new-password-error' : undefined}
          />
          {passwordError ? (
            <FieldError id="new-password-error" message={passwordError} />
          ) : (
            <span className="text-body-sm text-muted">
              Must contain uppercase, lowercase, a number and a special character.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Confirm new password</span>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="cb-input"
            placeholder="Re-enter your new password"
            aria-invalid={!!confirmError}
            aria-describedby={confirmError ? 'confirm-password-error' : undefined}
          />
          {confirmError ? (
            <FieldError id="confirm-password-error" message={confirmError} />
          ) : null}
        </label>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-hairline bg-surface-soft px-sm py-xs text-body-sm text-semantic-down"
          >
            {error}
          </div>
        ) : null}

        <button type="submit" disabled={isPending} className="cb-btn-primary w-full">
          {isPending ? (
            <span className="inline-flex items-center gap-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Updating
            </span>
          ) : (
            'Reset password'
          )}
        </button>

        <div className="flex flex-col gap-xs text-body-sm text-body md:flex-row md:items-center md:justify-end">
          <Link href="/login" className="cb-btn-tertiary h-11 px-0 text-body-sm">
            Back to sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
