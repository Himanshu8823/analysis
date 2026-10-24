'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/services/auth.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { setSession, getSession, signOut, updateSessionUser } from '@/lib/auth/session-client';
import { useToast } from '@/lib/utils/notifications';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  /** The primary role — what the sidebar and header badge gate on. */
  role: string;
  /** Every role the member holds. */
  roles?: string[];
  branchId?: string | null;
  mustChangePassword: boolean;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

interface LoginInput {
  email: string;
  password: string;
}

interface LoginVariables extends LoginInput {
  /** Where to land after a successful login. Defaults to `/dashboard`. */
  redirectTo?: string;
}

interface AcceptInviteInput {
  token: string;
  password: string;
}

interface ChangePasswordInput {
  currentPassword: string;
  password: string;
}

function persistAuthSession(data: AuthResponse): void {
  setSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  });
}

export function useLogin() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    // `redirectTo` is a client-side concern — the API rejects unknown body
    // properties, so only the credentials are sent over the wire.
    mutationFn: ({ email, password }: LoginVariables) => authService.login({ email, password }),
    onSuccess: (data, variables) => {
      persistAuthSession(data);
      qc.setQueryData(queryKeys.auth.me(), data.user);
      toast.success(`Welcome back, ${data.user.name}`);
      // A forced password change always wins over the requested destination.
      if (data.user.mustChangePassword) {
        router.push('/change-password');
        return;
      }
      router.push(variables.redirectTo ?? '/dashboard');
    },
    onError: (error: unknown) => {
      const message = extractErrorMessage(error);
      toast.error(message);
    },
  });
}

export function useAcceptInvite() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: AcceptInviteInput) => authService.acceptInvite(input),
    onSuccess: (data) => {
      persistAuthSession(data);
      qc.setQueryData(queryKeys.auth.me(), data.user);
      toast.success('Your account is ready');
      router.push('/dashboard');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

export function useResetPassword() {
  const toast = useToast();
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      authService.resetPassword(input),
    onSuccess: () => {
      toast.success('Password reset — sign in with your new password');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

export function useChangePassword() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => authService.changePassword(input),
    onSuccess: () => {
      // The backend cleared the flag; mirror it in the cached session so the
      // forced-change gate stops redirecting.
      updateSessionUser({ mustChangePassword: false });
      qc.setQueryData(queryKeys.auth.me(), (old: SessionUser | undefined) =>
        old ? { ...old, mustChangePassword: false } : old,
      );
      toast.success('Password updated');
      router.push('/dashboard');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

export function useForgotPassword() {
  const toast = useToast();
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
    onSuccess: () => {
      toast.success('Password reset link sent to your email');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      signOut();
      qc.clear();
      router.push('/login');
      toast.info('Signed out');
    },
    onError: () => {
      // Always clear client-side session regardless of network result.
      signOut();
      qc.clear();
      router.push('/login');
    },
  });
}

export function useCurrentUser() {
  const hasSession = typeof window !== 'undefined' && !!getSession();
  return useQuery<SessionUser>({
    queryKey: queryKeys.auth.me(),
    queryFn: () => authService.me(),
    staleTime: 60 * 1000,
    enabled: hasSession,
    retry: false,
  });
}

export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as {
      response?: {
        status?: number;
        data?: { message?: string | string[]; error?: { retryAfter?: number } };
      };
      message?: string;
    };

    const apiMessage = e.response?.data?.message;
    if (Array.isArray(apiMessage)) {
      if (apiMessage.length > 0) return apiMessage.join('. ');
    } else if (apiMessage) {
      return apiMessage;
    }

    // Axios' generic messages ("Request failed with status code 401") are not
    // user-facing — map them to something a person can act on.
    const status = e.response?.status;
    if (status === 401) return 'Your email or password is incorrect.';
    if (status === 403) return "You don't have permission to do that.";
    if (status === 404) return 'We could not find what you were looking for.';
    if (status === 409) return 'That already exists.';
    if (status === 429) {
      // The backend tells us how long to wait — surface it instead of a vague
      // "wait a moment".
      const retryAfter = e.response?.data?.error?.retryAfter;
      if (typeof retryAfter === 'number' && retryAfter > 0) {
        const minutes = Math.ceil(retryAfter / 60);
        return minutes > 1
          ? `Too many attempts. Please try again in ${minutes} minutes.`
          : 'Too many attempts. Please try again in a minute.';
      }
      return 'Too many attempts. Please wait a moment and try again.';
    }
    if (status && status >= 500) return 'Something went wrong on our side. Please try again.';

    if (e.message && !e.message.startsWith('Request failed with status code')) {
      return e.message;
    }
  }
  return 'Something went wrong. Please try again.';
}
