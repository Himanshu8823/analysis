'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardService, type DashboardData } from '@/lib/services/dashboard.service';

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.getDashboard(),
    staleTime: 60 * 1000,
  });
}