'use client';

import { useQuery } from '@tanstack/react-query';

import {
  auditLogsService,
  type AuditLog,
  type AuditLogFacets,
  type AuditLogFilters,
  type AuditLogListMeta,
} from '@/lib/services/audit-logs.service';
import { queryKeys } from '@/lib/query/queryKeys';

/**
 * The audit trail.
 *
 * The filters are part of the query key, so changing a filter fetches the
 * matching page rather than reusing the previous one's rows. The previous
 * page is kept on screen while the next one loads, so the table does not
 * flash empty on every filter change.
 */
export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery<{ items: AuditLog[]; meta: AuditLogListMeta }>({
    queryKey: queryKeys.auditLogs.list(filters),
    queryFn: () => auditLogsService.list(filters),
    placeholderData: (previous) => previous,
    staleTime: 30 * 1000,
  });
}

/**
 * The distinct actions, resources and users in the trail.
 *
 * The trail grows without bound, so the filter dropdowns are built from the
 * server's own aggregation rather than from the values a page happens to
 * contain — otherwise a value would vanish from the list the moment it
 * scrolled off the current page.
 */
export function useAuditLogFacets() {
  return useQuery<AuditLogFacets>({
    queryKey: queryKeys.auditLogs.facets(),
    queryFn: () => auditLogsService.facets(),
    staleTime: 5 * 60 * 1000,
  });
}
