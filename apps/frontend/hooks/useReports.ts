'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  reportsService,
  type GenerateReportPayload,
  type Report,
  type ReportListFilters,
  type ReportReadiness,
  type ReportScope,
} from '@/lib/services/reports.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import type { ListResponse } from '@/lib/types/api';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from './useAuth';

export function useGenerateReport() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: GenerateReportPayload) => reportsService.generate(payload),
    onSuccess: (report) => {
      invalidationRules.onReportGenerated(qc);
      qc.setQueryData(queryKeys.reports.detail(report.id), report);
      toast.success('Report generation started');
    },
    onError: (error: unknown) => {
      /**
       * The backend refuses a report for a class whose result is not
       * complete, and says what is missing. That message is far more useful
       * than a generic failure, so it is shown as it stands.
       */
      toast.error(extractErrorMessage(error));
    },
  });
}

/**
 * Archives a report.
 *
 * The report is not deleted: it is a statement about a class's results, so
 * the record is kept with the reason it was archived and who archived it.
 * The file is released.
 */
export function useArchiveReport() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      reportsService.archive(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.reports.all() });
      toast.success('Report archived. Its record has been kept.');
    },
    onError: (error: unknown) => toast.error(extractErrorMessage(error)),
  });
}

/**
 * Whether the class's result is complete enough to report on.
 *
 * The check runs as soon as the scope is complete, so the operator is told
 * what is missing before they press the button rather than after.
 */
export function useReportReadiness(scope?: ReportScope) {
  return useQuery<ReportReadiness>({
    queryKey: queryKeys.reports.readiness(scope),
    queryFn: () => reportsService.checkReadiness(scope as ReportScope),
    enabled: !!scope?.branchId && !!scope?.schemeId && !!scope?.academicYearId,
    staleTime: 30 * 1000,
  });
}

export function useReports(filters?: ReportListFilters) {
  return useQuery<ListResponse<Report>>({
    queryKey: queryKeys.reports.list(filters),
    queryFn: () => reportsService.list(filters),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    /**
     * The list only polls while at least one report is still being built.
     * Once every report has reached a terminal state the polling stops, so
     * an idle list does not keep hitting the API.
     */
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const hasPending = items.some(
        (report) => report.status === 'PENDING' || report.status === 'PROCESSING',
      );
      return hasPending ? 3000 : false;
    },
  });
}

export function useReport(id: string | null) {
  return useQuery<Report>({
    queryKey: id ? queryKeys.reports.detail(id) : ['reports', 'detail', 'noop'],
    queryFn: () => reportsService.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'PENDING' || status === 'PROCESSING') return 3000;
      return false;
    },
  });
}

export function useDownloadReport() {
  const toast = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const blob = await reportsService.download(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Report downloaded'),
    onError: (error: unknown) => {
      /**
       * A download is refused when the class's result is no longer complete
       * — marks may have been withdrawn since the report was queued. The
       * backend says what is missing, so that message is shown as it stands.
       */
      toast.error(extractErrorMessage(error));
    },
  });
}