import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

/** One entry in the audit trail. */
export interface AuditLog {
  id: string;
  /** The member who made the change. `null` for a system event. */
  userId: string | null;
  user?: { id: string; email: string; name: string } | null;
  /** What kind of change it was — `CREATE`, `UPDATE`, `DELETE`, … */
  action: string;
  /** Which entity it touched — `student`, `mark`, `upload_job`, … */
  resource: string;
  /** The id of the row that was changed. */
  resourceId: string | null;
  /** Extra detail about the change, as recorded by the route. */
  details?: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/** The page metadata the list endpoint returns alongside the rows. */
export interface AuditLogListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** The filters `GET /audit-logs` accepts. */
export interface AuditLogFilters {
  page?: number;
  pageSize?: number;
  userId?: string;
  /** One action, or several separated by commas. */
  action?: string;
  /** One resource, or several separated by commas. */
  resource?: string;
  fromDate?: string;
  toDate?: string;
  /** Free-text match over the resource id, action and resource. */
  search?: string;
  ipAddress?: string;
}

/** The distinct values present in the trail, for the filter dropdowns. */
export interface AuditLogFacets {
  actions: Array<{ value: string; count: number }>;
  resources: Array<{ value: string; count: number }>;
  users: Array<{ id: string; email: string; name: string }>;
}

export const auditLogsService = {
  list: async (
    filters: AuditLogFilters = {}
  ): Promise<{ items: AuditLog[]; meta: AuditLogListMeta }> => {
    const res = await apiClient.get(ENDPOINTS.AUDIT_LOGS.LIST, { params: filters });
    return res.data.data;
  },

  /** The distinct actions, resources and users in the trail. */
  facets: async (): Promise<AuditLogFacets> => {
    const res = await apiClient.get(ENDPOINTS.AUDIT_LOGS.FACETS);
    return res.data.data;
  },

  get: async (id: string): Promise<AuditLog> => {
    const res = await apiClient.get(ENDPOINTS.AUDIT_LOGS.DETAIL(id));
    return res.data.data;
  },
};
