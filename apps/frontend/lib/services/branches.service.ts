import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface Branch {
  id: string;
  code: string;
  name: string;
}

interface ListResponse<T> {
  data: T[];
  meta?: { total: number; page: number; pageSize: number };
}

export const branchesService = {
  list: async (): Promise<ListResponse<Branch>> => {
    const res = await apiClient.get(ENDPOINTS.BRANCHES.LIST);
    return res.data.data;
  },
  create: async (payload: { code: string; name: string }) => {
    const res = await apiClient.post(ENDPOINTS.BRANCHES.CREATE, payload);
    return res.data.data;
  },
  update: async (id: string, payload: { code?: string; name?: string }) => {
    const res = await apiClient.patch(ENDPOINTS.BRANCHES.UPDATE(id), payload);
    return res.data.data;
  },
  delete: async (id: string) => {
    await apiClient.delete(ENDPOINTS.BRANCHES.DELETE(id));
  },
};