'use client';

import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { useChangePassword } from '@/hooks/useAuth';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const changePassword = useChangePassword();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (!password) {
      setError('Please choose a new password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    changePassword.mutate(
      { currentPassword, password },
      {
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string } } };
          setError(e.response?.data?.message ?? 'We could not change your password.');
        },
      },
    );
  };

  return (
    <section className="space-y-lg">
      <div className="flex flex-col gap-xs">
        <span className="cb-badge">Account</span>
        <h1 className="text-title-sm text-ink">Change password</h1>
        <p className="text-body-sm text-body">
          Choose a new password for your account.
        </p>
      </div>

      <div className="cb-card max-w-lg">
        <form onSubmit={onSubmit} className="flex flex-col gap-base" noValidate>
          <label className="flex flex-col gap-xs">
            <span className="text-body-sm font-semibold text-ink">Current password</span>
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="cb-input"
              placeholder="Your current password"
              aria-invalid={!!error}
            />
          </label>

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
              aria-invalid={!!error}
            />
            <span className="text-body-sm text-muted">
              Must contain uppercase, lowercase, a number and a special character.
            </span>
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
              aria-invalid={!!error}
            />
          </label>

          {error ? (
            <div
              role="alert"
              className="rounded-md border border-hairline bg-surface-soft px-sm py-xs text-body-sm text-semantic-down"
            >
              {error}
            </div>
          ) : null}

          <button type="submit" disabled={changePassword.isPending} className="cb-btn-primary">
            {changePassword.isPending ? (
              <span className="inline-flex items-center gap-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Updating
              </span>
            ) : (
              'Update password'
            )}
          </button>
        </form>
      </div>
    </section>
  );
}
