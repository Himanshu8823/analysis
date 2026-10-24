import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface Scheme {
  id: string;
  /** The backend stores the scheme label in `name` (e.g. `SCHEME_2024`). */
  name: string;
  description: string;
  rules: Record<string, unknown>;
  isActive: boolean;
  effectiveFrom: string;
}

export interface SchemePayload {
  name: string;
  description: string;
  rules: Record<string, unknown>;
  effectiveFrom: string;
  isActive?: boolean;
}

export const schemesService = {
  /** The backend returns a plain array for schemes (no pagination). */
  list: async (): Promise<Scheme[]> => {
    const res = await apiClient.get(ENDPOINTS.SCHEMES.LIST);
    return res.data.data;
  },
  get: async (id: string): Promise<Scheme> => {
    const res = await apiClient.get(ENDPOINTS.SCHEMES.GET(id));
    return res.data.data;
  },
  create: async (payload: SchemePayload): Promise<Scheme> => {
    const res = await apiClient.post(ENDPOINTS.SCHEMES.CREATE, payload);
    return res.data.data;
  },
  /** The backend exposes `PUT /schemes/:id`, not `PATCH`. */
  update: async (id: string, payload: Partial<SchemePayload>): Promise<Scheme> => {
    const res = await apiClient.put(ENDPOINTS.SCHEMES.UPDATE(id), payload);
    return res.data.data;
  },
};
