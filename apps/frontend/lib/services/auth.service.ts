import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

interface LoginPayload {
  email: string;
  password: string;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  roles?: string[];
  /**
   * The member's effective permissions — the union of every role they hold.
   *
   * This is the authority the navigation gates on (§3.1): a feature is
   * reachable when the member holds the permission behind it, never because
   * of the name of a role. A member holding several roles gets the union,
   * so the list reflects every capability they actually have.
   */
  permissions?: string[];
  branchId?: string | null;
  mustChangePassword: boolean;
}

/**
 * The `me` endpoint returns the primary role (`role`) alongside the full list
 * (`roles: [...]`), while `login` returns a single primary role (`role`).
 * Both are normalised to the same shape here so every consumer of the session
 * user can rely on a single `role` string.
 */
interface AuthMeResponse {
  id: string;
  email: string;
  name: string;
  role?: string;
  roles: string[];
  permissions?: string[];
  branchId?: string | null;
  mustChangePassword: boolean;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/** Normalises the `me` payload into the same shape `login` returns. */
function toAuthUser(me: AuthMeResponse): AuthUser {
  const roles = me.roles ?? [];
  return {
    id: me.id,
    email: me.email,
    name: me.name,
    role: me.role ?? roles[0] ?? '',
    roles,
    permissions: me.permissions ?? [],
    branchId: me.branchId ?? null,
    mustChangePassword: me.mustChangePassword,
  };
}

export const authService = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const res = await apiClient.post(ENDPOINTS.AUTH.LOGIN, payload);
    return res.data.data;
  },
  logout: async (): Promise<void> => {
    await apiClient.post(ENDPOINTS.AUTH.LOGOUT);
  },
  me: async (): Promise<AuthUser> => {
    const res = await apiClient.get(ENDPOINTS.AUTH.ME);
    return toAuthUser(res.data.data as AuthMeResponse);
  },
  refresh: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
    const res = await apiClient.post(ENDPOINTS.AUTH.REFRESH, { refreshToken });
    return res.data.data;
  },
  forgotPassword: async (email: string) => {
    const res = await apiClient.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
    return res.data.data;
  },
  resetPassword: async (payload: { token: string; password: string }) => {
    const res = await apiClient.post(ENDPOINTS.AUTH.RESET_PASSWORD, payload);
    return res.data.data;
  },
  /** Accepts an invitation and creates the account with the chosen password. */
  acceptInvite: async (payload: { token: string; password: string }): Promise<AuthResponse> => {
    const res = await apiClient.post(ENDPOINTS.AUTH.ACCEPT_INVITE, payload);
    return res.data.data;
  },
  /** Changes the signed-in user's password. */
  changePassword: async (payload: {
    currentPassword: string;
    password: string;
  }): Promise<void> => {
    await apiClient.post(ENDPOINTS.AUTH.CHANGE_PASSWORD, payload);
  },
};
