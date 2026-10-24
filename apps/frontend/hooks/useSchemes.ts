'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { schemesService, type Scheme } from '@/lib/services/schemes.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import { useToast } from '@/lib/utils/notifications';

export function useSchemes() {
  return useQuery<{ data: Scheme[] }>({
    queryKey: queryKeys.schemes.list(),
    queryFn: () => schemesService.list(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useScheme(id: string | null) {
  return useQuery<Scheme>({
    queryKey: id ? queryKeys.schemes.detail(id) : ['schemes', 'detail', 'noop'],
    queryFn: () => schemesService.get(id!),
    enabled: !!id,
    staleTime: 30 * 60 * 1000,
  });
}

export function useCreateScheme() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: { code: string; name: string; year: number; rules?: Record<string, unknown> }) =>
      schemesService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.schemes.all() });
      toast.success('Scheme created');
    },
    onError: () => toast.error('Failed to create scheme'),
  });
}

export function useUpdateScheme() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<{ code: string; name: string; year: number; rules: Record<string, unknown> }>;
    }) => schemesService.update(id, payload),
    onSuccess: (_d, vars) => {
      invalidationRules.onSchemeUpdated(qc, vars.id);
      toast.success('Scheme updated');
    },
    onError: () => toast.error('Failed to update scheme'),
  });
}