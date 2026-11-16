import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { UserRole } from '@result-analysis/shared-types';

/**
 * A role a member holds, and the branch it is scoped to.
 *
 * A branch-scoped role (HOD, Principal, Teacher) is held *in a branch*, so
 * the same member may hold the Teacher role in two branches and the two
 * are separate rows — taking one back leaves the other alone.
 */
export interface UserRoleAssignment {
  roleName: UserRole;
  branchId?: string | null;
}

/** The body that assigns or takes back a role. */
export interface AssignRolePayload {
  userId: string;
  roleName: UserRole;
  /** Required for a branch-scoped role, and refused for a college-wide one. */
  branchId?: string;
}

/**
 * The row the read endpoint returns.
 *
 * The endpoint answers with the stored role rows, which carry the role and
 * the branch by name — the shape a person reads, not ids.
 */
export interface UserRoleRow {
  id: string;
  userId: string;
  roleId: string;
  branchId: string | null;
  grantedAt: string;
  role: { id: string; name: UserRole; description: string | null };
  branch: { id: string; code: string; name: string } | null;
}

export const userRolesService = {
  /**
   * The roles a member holds.
   *
   * A member with no roles is not an error — the endpoint says "not found"
   * for that case, so the empty answer is turned into an empty list here
   * rather than being surfaced as a failure to the person using the screen.
   */
  list: async (userId: string): Promise<UserRoleRow[]> => {
    try {
      const res = await apiClient.get(ENDPOINTS.USER_ROLES.LIST(userId));
      return res.data.data ?? [];
    } catch (error) {
      // 404 means "this member holds no roles yet" — the one case that is
      // an ordinary answer rather than a failure.
      if (isNotFound(error)) return [];
      throw error;
    }
  },

  /**
   * Gives a member a role.
   *
   * The backend decides whether this is allowed — the client only says
   * what is wanted, and is told plainly if it may not be done.
   */
  assign: async (payload: AssignRolePayload): Promise<void> => {
    await apiClient.post(ENDPOINTS.USER_ROLES.ASSIGN, payload);
  },

  /**
   * Takes a role back.
   *
   * The role is taken back only in the branch it was granted in, so a
   * Teacher in two branches keeps the other one.
   */
  revoke: async (payload: AssignRolePayload): Promise<void> => {
    await apiClient.delete(ENDPOINTS.USER_ROLES.REVOKE, { data: payload });
  },
};

/** Whether the failure is the backend saying "not found". */
function isNotFound(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 404;
}
