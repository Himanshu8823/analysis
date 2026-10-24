'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardService, type DashboardData } from '@/lib/services/dashboard.service';
import { queryKeys } from '@/lib/query/queryKeys';

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: queryKeys.dashboard.get(),
    queryFn: () => dashboardService.getDashboard(),
    staleTime: 60 * 1000,
  });
}
