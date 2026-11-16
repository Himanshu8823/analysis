'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/services/auth.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { setSession, getSession, signOut, updateSessionUser } from '@/lib/auth/session-client';
import { useToast } from '@/lib/utils/notifications';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  /** The primary role — what the header badge shows. */
  role: string;
  /** Every role the member holds. */
  roles?: string[];
  /**
   * The member's effective permissions — the union of every role they hold.
   * The navigation gates on these, never on a role name (§3.1).
   */
  permissions?: string[];
  branchId?: string | null;
  mustChangePassword: boolean;
  /**
   * The member's profile picture, as a URL into the object-storage bucket.
   * Absent when the member never picked one — the UI shows their initials.
   */
  avatarUrl?: string | null;
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
  /**
   * The stored session is read in an effect, never during render.
   *
   * `localStorage` only exists in the browser, so reading it while rendering
   * makes the server render and the first client render disagree — React
   * then reports a hydration mismatch and throws the whole tree away. The
   * state starts as `false` on both sides and settles to the real value once
   * the client has mounted.
   */
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(!!getSession());
  }, []);

  return useQuery<SessionUser>({
    queryKey: queryKeys.auth.me(),
    queryFn: () => authService.me(),
    staleTime: 60 * 1000,
    enabled: hasSession,
    retry: false,
  });
}

/**
 * Mirrors a changed user into the cached session and the React Query cache.
 *
 * The header renders from the cached session user, so a profile change has
 * to be written to both places — otherwise the header would keep showing the
 * old name until the page was reloaded.
 */
function applyUserUpdate(qc: ReturnType<typeof useQueryClient>, patch: Partial<SessionUser>): void {
  updateSessionUser(patch);
  qc.setQueryData(queryKeys.auth.me(), (old: SessionUser | undefined) =>
    old ? { ...old, ...patch } : old,
  );
}

/**
 * Updates the signed-in user's own name.
 *
 * The email is not part of this mutation — it identifies the account and is
 * never changed from the profile screen.
 */
export function useUpdateProfile() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: { name: string }) => authService.updateProfile(input),
    onSuccess: (data) => {
      applyUserUpdate(qc, { name: data.name });
      toast.success('Your profile has been updated');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/**
 * Uploads the signed-in user's profile picture.
 */
export function useUploadAvatar() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (file: File) => authService.uploadAvatar(file),
    onSuccess: (data) => {
      applyUserUpdate(qc, { avatarUrl: data.avatarUrl });
      toast.success('Your profile picture has been updated');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/**
 * Removes the signed-in user's profile picture.
 */
export function useRemoveAvatar() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: () => authService.removeAvatar(),
    onSuccess: () => {
      applyUserUpdate(qc, { avatarUrl: null });
      toast.success('Your profile picture has been removed');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/**
 * The message shown to the user when a request fails.
 *
 * The server sends its failures as `{ success: false, error: { code, message } }`.
 * The message inside `error` is the one the server wrote for the person
 * reading it — "You do not have access to the requested branch", "That
 * invitation has already been accepted" — and it is more useful than
 * anything that can be guessed from a status code. So it is read from
 * there.
 *
 * Older and third-party responses sometimes put the message at the top
 * level instead, and a validation failure puts an array of field messages
 * there, so both shapes are accepted.
 */
export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as {
      response?: {
        status?: number;
        data?: {
          message?: string | string[];
          error?: { message?: string | string[]; retryAfter?: number };
        };
      };
      message?: string;
      code?: string;
    };

    const status = e.response?.status;

    /**
     * A rate limit is handled first, whatever else the server said.
     *
     * "Too many attempts" on its own leaves the user guessing when they may
     * try again. The server knows — it sends the number of seconds — and
     * that is the one thing the user actually needs, so it is put in front
     * of the server's own wording rather than behind it.
     */
    if (status === 429) {
      const retryAfter = e.response?.data?.error?.retryAfter;
      if (typeof retryAfter === 'number' && retryAfter > 0) {
        const minutes = Math.ceil(retryAfter / 60);
        return minutes > 1
          ? `Too many attempts. Please try again in ${minutes} minutes.`
          : 'Too many attempts. Please try again in a minute.';
      }
      return 'Too many attempts. Please wait a moment and try again.';
    }

    // The server's own wording, from the shape the API actually returns.
    const apiErrorMessage = e.response?.data?.error?.message;
    if (Array.isArray(apiErrorMessage)) {
      if (apiErrorMessage.length > 0) return apiErrorMessage.join('. ');
    } else if (apiErrorMessage) {
      return apiErrorMessage;
    }

    // A top-level message, as sent by a validation failure or a
    // response that does not follow the API's error envelope.
    const apiMessage = e.response?.data?.message;
    if (Array.isArray(apiMessage)) {
      if (apiMessage.length > 0) return apiMessage.join('. ');
    } else if (apiMessage) {
      return apiMessage;
    }

    // Axios' generic messages ("Request failed with status code 401") are not
    // user-facing — map them to something a person can act on.
    if (status === 401) return 'Your email or password is incorrect.';
    if (status === 403) return "You don't have permission to do that.";
    if (status === 404) return 'We could not find what you were looking for.';
    if (status === 409) return 'That already exists.';

    /**
     * A validation failure. The server names the fields that failed, and
     * that naming is the whole value of the message — it is attached to the
     * field on the form. Without a server message the best a fallback can
     * do is say that something in the form needs attention.
     */
    if (status === 422 || status === 400) {
      return 'Please check the highlighted fields and try again.';
    }

    if (status && status >= 500) return 'Something went wrong on our side. Please try again.';

    /**
     * A request that never reached the server.
     *
     * This is a different kind of failure from a 500, and it must not look
     * like one: nothing went wrong on the server's side, because the server
     * was never asked. It is the member's connection, and telling them to
     * "try again" without saying so sends them looking for a fault in the
     * application.
     */
    if (e.code === 'ERR_NETWORK' || e.message === 'Network Error') {
      return 'We could not reach the server. Check your connection and try again.';
    }

    /**
     * A request that timed out. The server may still be working on it, but
     * the member cannot wait, so the message says so and says what to do.
     */
    if (e.code === 'ECONNABORTED' || e.message?.toLowerCase().includes('timeout')) {
      return 'The server took too long to respond. Check your connection and try again.';
    }

    if (e.message && !e.message.startsWith('Request failed with status code')) {
      return e.message;
    }
  }
  return 'Something went wrong. Please try again.';
}
