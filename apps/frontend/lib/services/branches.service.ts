import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface Branch {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
}

/** The body `POST /branches` accepts. */
export interface CreateBranchPayload {
  code: string;
  name: string;
  isActive?: boolean;
}

export const branchesService = {
  /** The backend returns a plain array for branches (no pagination). */
  list: async (): Promise<Branch[]> => {
    const res = await apiClient.get(ENDPOINTS.BRANCHES.LIST);
    return res.data.data;
  },
  create: async (payload: CreateBranchPayload) => {
    const res = await apiClient.post(ENDPOINTS.BRANCHES.CREATE, payload);
    return res.data.data;
  },
  /** The backend exposes `PUT /branches/:id`, not `PATCH`. */
  update: async (id: string, payload: Partial<CreateBranchPayload>) => {
    const res = await apiClient.put(ENDPOINTS.BRANCHES.UPDATE(id), payload);
    return res.data.data;
  },
  delete: async (id: string) => {
    await apiClient.delete(ENDPOINTS.BRANCHES.DELETE(id));
  },
};