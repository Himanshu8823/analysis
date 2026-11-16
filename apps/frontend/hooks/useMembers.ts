'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  usersService,
  type MemberListFilters,
  type RevocationImpact,
  type RoleSummary,
} from '@/lib/services/users.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from './useAuth';

export function useMembers(filters?: MemberListFilters) {
  return useQuery({
    queryKey: queryKeys.members.list(filters),
    queryFn: () => usersService.listMembers(filters),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useRoles() {
  return useQuery<RoleSummary[]>({
    queryKey: queryKeys.members.roles(),
    queryFn: () => usersService.listRoles(),
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetches a single member for the edit page. */
export function useMember(id: string | null) {
  return useQuery({
    queryKey: queryKeys.members.detail(id ?? ''),
    queryFn: () => usersService.getMember(id as string),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

/**
 * What revoking this member would do.
 *
 * Read-only. It is fetched before the confirmation is shown, so the
 * administrator sees the consequences — the allocations released, the classes
 * that lose their class teacher — before committing to the change.
 */
export function useRevocationImpact(memberId: string | null) {
  return useQuery<RevocationImpact>({
    queryKey: queryKeys.members.revocationImpact(memberId ?? ''),
    queryFn: () => usersService.revocationImpact(memberId as string),
    enabled: !!memberId,
    staleTime: 30 * 1000,
  });
}

/**
 * Revokes a member's access.
 *
 * The whole lifecycle runs server-side: the account is deactivated, every
 * session is revoked, pending invitations are withdrawn, allocations and
 * class teacher assignments are released, and the roles are removed. The
 * reason is required and is recorded in the audit trail.
 *
 * The member's history is **kept** — this is a revocation, not a deletion.
 */
export function useRevokeMember() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      usersService.revoke(id, reason),
    onSuccess: () => {
      invalidationRules.onMemberUpdated(qc);
      toast.success('Access revoked. Their history has been kept.');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/**
 * Restores a revoked member's account.
 *
 * Their allocations and roles are **not** restored automatically — they were
 * released deliberately, and the administrator re-applies them by hand. The
 * reason is required and is recorded in the audit trail.
 */
export function useRestoreMember() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      usersService.restore(id, reason),
    onSuccess: () => {
      invalidationRules.onMemberUpdated(qc);
      toast.success('Member restored. Their subjects and roles still need to be reassigned.');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/** Edits a member's name or email address. */
export function useUpdateMember() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<{ email: string; name: string }>;
    }) => usersService.update(id, payload),
    onSuccess: () => {
      invalidationRules.onMemberUpdated(qc);
      toast.success('Member updated');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}
