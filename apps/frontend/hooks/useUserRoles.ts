'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  userRolesService,
  type AssignRolePayload,
  type UserRoleRow,
} from '@/lib/services/user-roles.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from './useAuth';

/**
 * The roles a member holds.
 *
 * The member record already carries its roles, so this hook is for the
 * screen that manages them — it reads the rows back with the branch they
 * belong to, which the member list does not carry.
 */
export function useUserRoles(userId: string | null) {
  return useQuery<UserRoleRow[]>({
    queryKey: queryKeys.userRoles.list(userId ?? ''),
    queryFn: () => userRolesService.list(userId as string),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

/**
 * Gives a member a role.
 *
 * The change takes effect on the member's very next request: the backend
 * invalidates the permission cache as part of the grant, so there is
 * nothing for the person to refresh or re-login to do.
 */
export function useAssignRole() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: AssignRolePayload) => userRolesService.assign(payload),
    onSuccess: (_data, variables) => {
      invalidationRules.onMemberRolesChanged(qc, variables.userId);
      toast.success(`${roleLabel(variables.roleName)} role assigned`);
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/**
 * Takes a role back from a member.
 *
 * The role goes back only in the branch it was granted in, so a Teacher who
 * works in two branches keeps the other one.
 */
export function useRevokeRole() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: AssignRolePayload) => userRolesService.revoke(payload),
    onSuccess: (_data, variables) => {
      invalidationRules.onMemberRolesChanged(qc, variables.userId);
      toast.success(`${roleLabel(variables.roleName)} role removed`);
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/** The name of a role, written the way the screens say it. */
function roleLabel(roleName: string): string {
  switch (roleName) {
    case 'HOD':
      return 'Head of Department';
    case 'PRINCIPAL':
      return 'Principal';
    case 'TEACHER':
      return 'Teacher';
    case 'ADMIN':
      return 'Admin';
    case 'STUDENT':
      return 'Student';
    default:
      return roleName;
  }
}
