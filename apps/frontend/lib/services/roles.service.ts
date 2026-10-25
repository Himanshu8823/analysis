import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

/**
 * A role as returned by `GET /roles`.
 *
 * `_count` comes from the backend's `include` — `userRoles` is how many
 * members hold the role, `rolePermissions` is how many permissions it
 * currently carries.
 */
export interface Role {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    userRoles: number;
    rolePermissions: number;
  };
}

/** A permission as returned by `GET /permissions`. */
export interface Permission {
  id: string;
  /** `resource:action`, e.g. `students:read`. */
  name: string;
  resource: string;
  action: string;
  description: string | null;
  createdAt: string;
}

/** The body `POST /roles` accepts. */
export interface CreateRolePayload {
  name: string;
  description?: string;
  isActive?: boolean;
}

/** The body `POST /permissions` accepts. */
export interface CreatePermissionPayload {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

export const rolesService = {
  /** The backend returns a plain array for roles (no pagination). */
  list: async (): Promise<Role[]> => {
    const res = await apiClient.get(ENDPOINTS.ROLES.LIST);
    return res.data.data;
  },
  get: async (id: string): Promise<Role> => {
    const res = await apiClient.get(ENDPOINTS.ROLES.GET(id));
    return res.data.data;
  },
  /** The permissions currently assigned to a role. */
  listPermissions: async (roleId: string): Promise<Permission[]> => {
    const res = await apiClient.get(ENDPOINTS.ROLES.PERMISSIONS(roleId));
    return res.data.data;
  },
  create: async (payload: CreateRolePayload): Promise<Role> => {
    const res = await apiClient.post(ENDPOINTS.ROLES.CREATE, payload);
    return res.data.data;
  },
  /** The backend exposes `PUT /roles/:id`, not `PATCH`. */
  update: async (id: string, payload: Partial<CreateRolePayload>): Promise<Role> => {
    const res = await apiClient.put(ENDPOINTS.ROLES.UPDATE(id), payload);
    return res.data.data;
  },
  /**
   * Removes every permission from the role and re-assigns the given set.
   *
   * The backend expects permission **IDs**, not names — the whole set is
   * replaced, so an omitted permission is revoked.
   */
  assignPermissions: async (roleId: string, permissionIds: string[]): Promise<void> => {
    await apiClient.put(ENDPOINTS.ROLES.ASSIGN_PERMISSIONS(roleId), { permissionIds });
  },
  /**
   * Deactivates a role.
   *
   * The backend soft-deletes: it flips `isActive` to false rather than
   * removing the row, so members holding the role keep their assignment but
   * the role stops granting access.
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(ENDPOINTS.ROLES.DELETE(id));
  },
};

export const permissionsService = {
  /** The backend returns a plain array for permissions (no pagination). */
  list: async (): Promise<Permission[]> => {
    const res = await apiClient.get(ENDPOINTS.PERMISSIONS.LIST);
    return res.data.data;
  },
  create: async (payload: CreatePermissionPayload): Promise<Permission> => {
    const res = await apiClient.post(ENDPOINTS.PERMISSIONS.CREATE, payload);
    return res.data.data;
  },
  /**
   * Removes a permission from the catalogue entirely.
   *
   * The row is hard-deleted here, so every role that held it loses it. The
   * permission's *name* is the key the RBAC cache is built on, which is why
   * renaming is deliberately not offered.
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(ENDPOINTS.PERMISSIONS.DELETE(id));
  },
};
