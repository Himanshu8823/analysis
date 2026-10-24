'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersService, type MemberListFilters, type RoleSummary } from '@/lib/services/users.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from './useAuth';

export function useMembers(filters?: MemberListFilters) {
  return useQuery({
    queryKey: queryKeys.members.list(filters),
    queryFn: () => usersService.listMembers(filters),
    staleTime: 60 * 1000,
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

/** Activates or deactivates a member. */
export function useSetMemberActive() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersService.update(id, { isActive }),
    onSuccess: (_data, variables) => {
      invalidationRules.onMemberUpdated(qc);
      toast.success(variables.isActive ? 'Member activated' : 'Member deactivated');
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

/** Removes a member account permanently. */
export function useDeleteMember() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => usersService.delete(id),
    onSuccess: () => {
      invalidationRules.onMemberUpdated(qc);
      toast.success('Member removed');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}
