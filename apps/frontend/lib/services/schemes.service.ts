import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface Scheme {
  id: string;
  code: string;
  name: string;
  year: number;
  rules?: Record<string, unknown>;
}

interface ListResponse<T> {
  data: T[];
  meta?: { total: number; page: number; pageSize: number };
}

export const schemesService = {
  list: async (): Promise<ListResponse<Scheme>> => {
    const res = await apiClient.get(ENDPOINTS.SCHEMES.LIST);
    return res.data.data;
  },
  get: async (id: string): Promise<Scheme> => {
    const res = await apiClient.get(ENDPOINTS.SCHEMES.GET(id));
    return res.data.data;
  },
  create: async (payload: { code: string; name: string; year: number; rules?: Record<string, unknown> }) => {
    const res = await apiClient.post(ENDPOINTS.SCHEMES.CREATE, payload);
    return res.data.data;
  },
  update: async (id: string, payload: Partial<{ code: string; name: string; year: number; rules: Record<string, unknown> }>) => {
    const res = await apiClient.patch(ENDPOINTS.SCHEMES.UPDATE(id), payload);
    return res.data.data;
  },
};