'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLogin } from '@/hooks/useAuth';
import { useToast } from '@/lib/utils/notifications';
import { Spinner } from '@/components/feedback/Spinner';
import { FieldError } from '@/components/feedback/FieldError';

interface AxiosLikeError {
  response?: {
    status?: number;
    data?: {
      message?: string | string[];
      retryAfter?: number;
    };
  };
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="cb-card-elevated flex min-h-[420px] items-center justify-center">
      <Spinner size={28} label="Loading" />
    </div>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const redirectTo = params.get('redirect') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const { mutate: login, isPending } = useLogin();
  const toast = useToast();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError(null);
    setPasswordError(null);

    if (!email.trim()) {
      setEmailError('Enter your email address');
    }
    if (!password) {
      setPasswordError('Enter your password');
    }
    if (!email.trim() || !password) {
      return;
    }

    login(
      { email, password, redirectTo },
      {
        onError: (err: unknown) => {
          const e = err as AxiosLikeError;
          const status = e.response?.status;
          const retryAfter = e.response?.data?.retryAfter;
          if (status === 429) {
            // The shared toast already shows an error — this only sharpens the
            // message with the retry window the backend reports.
            toast.error(
              retryAfter
                ? `Too many login attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`
                : 'Too many login attempts. Please wait and try again.',
            );
          }
        },
      },
    );
  };

  return (
    <div className="cb-card-elevated">
      <div className="mb-lg flex flex-col gap-xs">
        <h1 className="cb-auth-heading">Sign in</h1>
        <p className="text-body-sm text-body">
          Access your result analysis dashboard.
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

        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="cb-input"
            placeholder="Enter your password"
            aria-invalid={!!passwordError}
            aria-describedby={passwordError ? 'password-error' : undefined}
          />
          {passwordError ? <FieldError id="password-error" message={passwordError} /> : null}
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="cb-btn-primary w-full"
        >
          {isPending ? (
            <span className="inline-flex items-center gap-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Signing in
            </span>
          ) : (
            'Sign in'
          )}
        </button>

        <div className="flex flex-col gap-xs text-body-sm text-body md:flex-row md:items-center md:justify-end">
          <Link href="/forgot-password" className="cb-btn-tertiary h-11 px-0 text-body-sm">
            Forgot password?
          </Link>
        </div>
      </form>
    </div>
  );
}