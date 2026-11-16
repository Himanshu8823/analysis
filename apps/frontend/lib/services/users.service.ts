import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Member, MemberRole, UserRole } from '@result-analysis/shared-types';
import type { ListResponse } from '@/lib/types/api';

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

/**
 * What revoking a member would do.
 *
 * The `consequences` are sentences written by the server for a college
 * administrator — they name branches, subjects and semesters, never ids.
 */
export interface RevocationImpact {
  memberName: string;
  memberEmail: string;
  isActive: boolean;
  subjectAllocations: number;
  allocatedSubjects: Array<{
    subjectName: string;
    subjectCode: string;
    branchName: string;
    semester: number;
  }>;
  classTeacherAssignments: number;
  classesLosingTeacher: Array<{
    branchName: string;
    semester: number;
    schemeName: string;
    academicYear: string;
  }>;
  activeSessions: number;
  pendingInvitations: number;
  roles: string[];
  consequences: string[];
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
  /** Fetches a single member, used by the edit page. */
  getMember: async (id: string): Promise<Member> => {
    const res = await apiClient.get(ENDPOINTS.USERS.GET(id));
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
  /**
   * Revokes a member's access.
   *
   * The whole lifecycle runs server-side: the account is deactivated, every
   * session is revoked, pending invitations are withdrawn, allocations and
   * class teacher assignments are released, and the roles are removed. The
   * reason is required and is recorded in the audit trail.
   *
   * The backend exposes this as `DELETE /users/:id` — it is a revocation, not
   * a hard delete; the member's history is kept.
   */
  revoke: async (id: string, reason: string) => {
    await apiClient.delete(ENDPOINTS.USERS.DELETE(id), { data: { reason } });
  },
  /**
   * What revoking this member would do.
   *
   * Read-only. The member's history is never touched by this call.
   */
  revocationImpact: async (id: string): Promise<RevocationImpact> => {
    const res = await apiClient.get(ENDPOINTS.USERS.REVOCATION_IMPACT(id));
    return res.data.data;
  },
  /**
   * Restores a revoked member's account.
   *
   * Their allocations and roles are **not** restored automatically — they
   * were released deliberately, and the administrator re-applies them by
   * hand. The reason is required and is recorded in the audit trail.
   */
  restore: async (id: string, reason: string) => {
    await apiClient.post(ENDPOINTS.USERS.RESTORE(id), { reason });
  },
};

export type { Member, MemberRole };
