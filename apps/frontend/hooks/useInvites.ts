'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  invitesService,
  type InviteCounts,
  type InviteListFilters,
  type InviteUserPayload,
} from '@/lib/services/invites.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from './useAuth';

export function useInvites(filters?: InviteListFilters) {
  return useQuery({
    queryKey: queryKeys.invites.list(filters),
    queryFn: () => invitesService.list(filters),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    /**
     * An invitation's state changes on the server (accepted, revoked,
     * superseded) and the tab counters have to agree with the list. The
     * list is refetched whenever it is mounted so the two never drift
     * apart.
     */
    refetchOnMount: 'always',
  });
}

export function useInviteCounts() {
  return useQuery<InviteCounts>({
    queryKey: queryKeys.invites.counts(),
    queryFn: () => invitesService.counts(),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: InviteUserPayload) => invitesService.create(payload),
    onSuccess: () => {
      invalidationRules.onInviteSent(qc);
      toast.success('Invitation sent');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => invitesService.revoke(id),
    onSuccess: () => {
      invalidationRules.onInviteRevoked(qc);
      toast.success('Invitation revoked');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

export function useResendInvite() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => invitesService.resend(id),
    onSuccess: () => {
      invalidationRules.onInviteResent(qc);
      toast.success('Invitation resent');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/**
 * Validates an invitation token.
 *
 * Enabled only once a token is present, and it never retries — a rejected
 * token will not become valid by asking again.
 */
export function useValidateInvite(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invites.validate(token ?? ''),
    queryFn: () => invitesService.validate(token as string),
    enabled: Boolean(token),
    retry: false,
    staleTime: 60 * 1000,
  });
}
