'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  reportsService,
  type GenerateReportPayload,
  type Report,
  type ReportListFilters,
} from '@/lib/services/reports.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import type { ListResponse } from '@/lib/types/api';
import { useToast } from '@/lib/utils/notifications';

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
    onError: () => toast.error('Failed to start report generation'),
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
    onError: () => toast.error('Failed to download report'),
  });
}