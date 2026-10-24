import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Invite, InviteStatus, UserRole } from '@result-analysis/shared-types';

export interface InviteListFilters {
  status?: InviteStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface InviteListResponse {
  items: Invite[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export interface InviteCounts {
  PENDING: number;
  ACCEPTED: number;
  REVOKED: number;
  EXPIRED: number;
}

export interface InviteValidation {
  valid: true;
  email: string;
  name: string;
  roleName: UserRole;
  branchId: string | null;
  expiresAt: string;
}

export interface InviteUserPayload {
  email: string;
  name: string;
  roleName: UserRole;
  branchId?: string;
}

export const invitesService = {
  list: async (filters?: InviteListFilters): Promise<InviteListResponse> => {
    const res = await apiClient.get(ENDPOINTS.INVITES.LIST, { params: filters });
    return res.data.data;
  },
  counts: async (): Promise<InviteCounts> => {
    const res = await apiClient.get(ENDPOINTS.INVITES.COUNTS);
    return res.data.data;
  },
  /** Sends an invitation and returns the record, including the accept link. */
  create: async (payload: InviteUserPayload): Promise<Invite> => {
    const res = await apiClient.post(ENDPOINTS.INVITES.CREATE, payload);
    return res.data.data;
  },
  revoke: async (id: string): Promise<Invite> => {
    const res = await apiClient.post(ENDPOINTS.INVITES.REVOKE(id));
    return res.data.data;
  },
  resend: async (id: string): Promise<Invite> => {
    const res = await apiClient.post(ENDPOINTS.INVITES.RESEND(id));
    return res.data.data;
  },
  /** Checks an invitation token without consuming it. */
  validate: async (token: string): Promise<InviteValidation> => {
    const res = await apiClient.get(ENDPOINTS.INVITES.VALIDATE(token));
    return res.data.data;
  },
};
