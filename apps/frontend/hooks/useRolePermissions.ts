'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  permissionsService,
  rolesService,
  type CreatePermissionPayload,
  type CreateRolePayload,
  type Permission,
  type Role,
} from '@/lib/services/roles.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from './useAuth';

/**
 * Roles & permissions hooks.
 *
 * The names are deliberately distinct from the `useRoles` exported by
 * `@/hooks/useMembers` (which serves the member-assignment dropdowns from
 * `GET /users/roles`). This file talks to the RBAC endpoints instead, so
 * both can be imported side by side without a name clash.
 */

/** Lists every role with its member and permission counts. */
export function useRoleList() {
  return useQuery<Role[]>({
    queryKey: queryKeys.roles.list(),
    queryFn: () => rolesService.list(),
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetches a single role. */
export function useRole(id: string | null) {
  return useQuery<Role>({
    queryKey: id ? queryKeys.roles.detail(id) : ['roles', 'detail', 'noop'],
    queryFn: () => rolesService.get(id as string),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Lists the permissions currently assigned to a role.
 *
 * Disabled until a role is selected — the endpoint is role-scoped, so there
 * is nothing to fetch beforehand.
 */
export function useRolePermissions(roleId: string | null) {
  return useQuery<Permission[]>({
    queryKey: roleId ? queryKeys.roles.permissions(roleId) : ['roles', 'permissions', 'noop'],
    queryFn: () => rolesService.listPermissions(roleId as string),
    enabled: !!roleId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Lists the full permission catalogue. */
export function usePermissionCatalogue() {
  return useQuery<Permission[]>({
    queryKey: queryKeys.permissions.list(),
    queryFn: () => permissionsService.list(),
    staleTime: 30 * 60 * 1000,
  });
}

/** Creates a new role. */
export function useCreateRole() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: CreateRolePayload) => rolesService.create(payload),
    onSuccess: () => {
      invalidationRules.onRolesChanged(qc);
      toast.success('Role created');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/** Renames a role or changes its description. */
export function useUpdateRole() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<CreateRolePayload>;
    }) => rolesService.update(id, payload),
    onSuccess: (_data, variables) => {
      invalidationRules.onRolesChanged(qc, variables.id);
      toast.success('Role updated');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/**
 * Deactivates a role.
 *
 * The backend soft-deletes (it flips `isActive` to false), so the role
 * survives and its members keep the assignment — the role simply stops
 * granting access.
 */
export function useDeactivateRole() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => rolesService.delete(id),
    onSuccess: (_data, variables) => {
      invalidationRules.onRolesChanged(qc, variables);
      toast.success('Role deactivated');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/**
 * Replaces a role's permission set.
 *
 * The backend replaces the whole set, so the caller must send every
 * permission the role should keep — an omitted one is revoked.
 */
export function useAssignRolePermissions() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({
      id,
      permissionIds,
    }: {
      id: string;
      permissionIds: string[];
    }) => rolesService.assignPermissions(id, permissionIds),
    onSuccess: (_data, variables) => {
      invalidationRules.onRolesChanged(qc, variables.id);
      toast.success('Permissions updated');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/** Adds a permission to the catalogue. */
export function useCreatePermission() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: CreatePermissionPayload) => permissionsService.create(payload),
    onSuccess: () => {
      invalidationRules.onRolesChanged(qc);
      toast.success('Permission created');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/** Removes a permission from the catalogue entirely. */
export function useDeletePermission() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => permissionsService.delete(id),
    onSuccess: () => {
      invalidationRules.onRolesChanged(qc);
      toast.success('Permission deleted');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}
