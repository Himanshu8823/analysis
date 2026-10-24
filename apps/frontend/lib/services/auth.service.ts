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
  branchId?: string | null;
  mustChangePassword: boolean;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export const authService = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const res = await apiClient.post(ENDPOINTS.AUTH.LOGIN, payload);
    return res.data.data;
  },
  logout: async (): Promise<void> => {
    await apiClient.post(ENDPOINTS.AUTH.LOGOUT);
  },
  me: async () => {
    const res = await apiClient.get(ENDPOINTS.AUTH.ME);
    return res.data.data;
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
