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
  role: string;
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
    mutationFn: (input: LoginVariables) => authService.login(input),
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
    const e = error as { response?: { data?: { message?: string } }; message?: string };
    const apiMessage = e.response?.data?.message;
    if (apiMessage) return apiMessage;
    if (e.message) return e.message;
  }
  return 'Something went wrong. Please try again.';
}
