import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Member, MemberRole, UserRole } from '@result-analysis/shared-types';

interface ListResponse<T> {
  items: T[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export interface MemberListFilters {
  search?: string;
  role?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
}

export interface RoleSummary {
  id: string;
  name: UserRole;
  description: string | null;
  isActive: boolean;
  _count: {
    userRoles: number;
    rolePermissions: number;
  };
}

export const usersService = {
  /** Lists members with their assigned roles. */
  listMembers: async (filters?: MemberListFilters): Promise<ListResponse<Member>> => {
    const res = await apiClient.get(ENDPOINTS.USERS.MEMBERS, { params: filters });
    return res.data.data;
  },
  /** Lists the roles that can be assigned, with member counts. */
  listRoles: async (): Promise<RoleSummary[]> => {
    const res = await apiClient.get(ENDPOINTS.USERS.ROLES);
    return res.data.data;
  },
  /** The backend exposes `PUT /users/:id`, not `PATCH`. */
  update: async (
    id: string,
    payload: Partial<{ email: string; name: string; isActive: boolean; password: string }>,
  ) => {
    const res = await apiClient.put(ENDPOINTS.USERS.UPDATE(id), payload);
    return res.data.data;
  },
  delete: async (id: string) => {
    await apiClient.delete(ENDPOINTS.USERS.DELETE(id));
  },
};

export type { Member, MemberRole };
