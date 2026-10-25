'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  branchesService,
  type Branch,
  type CreateBranchPayload,
} from '@/lib/services/branches.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from './useAuth';

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
    mutationFn: (payload: CreateBranchPayload) => branchesService.create(payload),
    onSuccess: () => {
      invalidationRules.onBranchChanged(qc);
      toast.success('Branch created');
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateBranchPayload> }) =>
      branchesService.update(id, payload),
    onSuccess: () => {
      invalidationRules.onBranchChanged(qc);
      toast.success('Branch updated');
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => branchesService.delete(id),
    onSuccess: () => {
      invalidationRules.onBranchChanged(qc);
      toast.success('Branch removed');
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}
