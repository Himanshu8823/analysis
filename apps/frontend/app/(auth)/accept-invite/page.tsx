'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useValidateInvite } from '@/hooks/useInvites';
import { useAcceptInvite } from '@/hooks/useAuth';
import { Spinner } from '@/components/feedback/Spinner';

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AcceptInviteSkeleton />}>
      <AcceptInviteForm />
    </Suspense>
  );
}

function AcceptInviteSkeleton() {
  return (
    <div className="cb-card-elevated flex min-h-[420px] items-center justify-center">
      <Spinner size={28} label="Loading" />
    </div>
  );
}

function AcceptInviteForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? undefined;

  const validation = useValidateInvite(token);
  const acceptInvite = useAcceptInvite();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('This invitation link is missing its token.');
      return;
    }

    if (!password) {
      setError('Please choose a password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    acceptInvite.mutate(
      { token, password },
      {
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string } } };
          setError(e.response?.data?.message ?? 'We could not accept this invitation.');
        },
      },
    );
  };

  // ── Missing token ────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="cb-card-elevated">
        <div className="mb-lg flex flex-col gap-xs">
          <h1 className="cb-auth-heading">Invalid invitation</h1>
          <p className="text-body-sm text-body">
            This link is missing its invitation token. Ask your administrator to send a new
            invitation.
          </p>
        </div>
      </div>
    );
  }

  // ── Validating ───────────────────────────────────────────────────────────
  if (validation.isLoading) {
    return (
      <div className="cb-card-elevated flex min-h-[420px] items-center justify-center">
        <Spinner size={28} label="Checking your invitation" />
      </div>
    );
  }

  // ── Rejected ─────────────────────────────────────────────────────────────
  if (validation.isError) {
    const e = validation.error as { response?: { data?: { message?: string } } };
    return (
      <div className="cb-card-elevated">
        <div className="mb-lg flex flex-col gap-xs">
          <h1 className="cb-auth-heading">Invitation not valid</h1>
          <p className="text-body-sm text-body">
            {e.response?.data?.message ??
              'This invitation is invalid or has already been used. Ask your administrator to send a new invitation.'}
          </p>
        </div>
      </div>
    );
  }

  const invite = validation.data;

  if (!invite) {
    return (
      <div className="cb-card-elevated">
        <div className="mb-lg flex flex-col gap-xs">
          <h1 className="cb-auth-heading">Invitation not valid</h1>
          <p className="text-body-sm text-body">
            This invitation is invalid or has already been used. Ask your administrator to send a
            new invitation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cb-card-elevated">
      <div className="mb-lg flex flex-col gap-xs">
        <h1 className="cb-auth-heading">Accept your invitation</h1>
        <p className="text-body-sm text-body">
          Choose a password to activate your account for the DBATU Result Analysis System.
        </p>
      </div>

      <div className="mb-lg flex flex-col gap-xs rounded-md border border-hairline bg-surface-soft px-sm py-base">
        <div className="flex flex-col gap-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-body-sm text-body">Name</span>
          <span className="text-body-sm font-semibold text-ink">{invite.name}</span>
        </div>
        <div className="flex flex-col gap-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-body-sm text-body">Email</span>
          <span className="text-body-sm font-semibold text-ink">{invite.email}</span>
        </div>
        <div className="flex flex-col gap-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-body-sm text-body">Role</span>
          <span className="cb-badge">{invite.roleName}</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-base" noValidate>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Password</span>
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
          <span className="text-body-sm font-semibold text-ink">Confirm password</span>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="cb-input"
            placeholder="Re-enter your password"
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

        <button type="submit" disabled={acceptInvite.isPending} className="cb-btn-primary w-full">
          {acceptInvite.isPending ? (
            <span className="inline-flex items-center gap-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Creating your account
            </span>
          ) : (
            'Accept invitation'
          )}
        </button>
      </form>
    </div>
  );
}
