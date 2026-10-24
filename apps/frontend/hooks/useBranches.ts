'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branchesService, type Branch } from '@/lib/services/branches.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { useToast } from '@/lib/utils/notifications';

export function useBranches() {
  return useQuery<Branch[]>({
    queryKey: queryKeys.branches.list(),
    queryFn: () => branchesService.list(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: { code: string; name: string }) => branchesService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.branches.all() });
      toast.success('Branch created');
    },
    onError: () => toast.error('Failed to create branch'),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { code?: string; name?: string } }) =>
      branchesService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.branches.all() });
      toast.success('Branch updated');
    },
    onError: () => toast.error('Failed to update branch'),
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => branchesService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.branches.all() });
      toast.success('Branch removed');
    },
    onError: () => toast.error('Failed to delete branch'),
  });
}