'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subjectsService, type Subject, type SubjectListFilters } from '@/lib/services/subjects.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { useToast } from '@/lib/utils/notifications';

export function useSubjects(filters?: SubjectListFilters) {
  return useQuery<{ data: Subject[] }>({
    queryKey: queryKeys.subjects.list(filters),
    queryFn: () => subjectsService.list(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubjectsByBranchSchemeSem(branchId: string, schemeId: string, semester: number) {
  return useQuery<{ data: Subject[] }>({
    queryKey: queryKeys.subjects.byBranchSchemeSem(branchId, schemeId, semester),
    queryFn: () => subjectsService.list({ branchId, schemeId, semester }),
    enabled: !!branchId && !!schemeId && semester > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSubject() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: Omit<Subject, 'id'>) => subjectsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.subjects.all() });
      toast.success('Subject created');
    },
    onError: () => toast.error('Failed to create subject'),
  });
}

export function useUpdateSubject() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<Subject, 'id'>> }) =>
      subjectsService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.subjects.all() });
      toast.success('Subject updated');
    },
    onError: () => toast.error('Failed to update subject'),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => subjectsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.subjects.all() });
      toast.success('Subject removed');
    },
    onError: () => toast.error('Failed to delete subject'),
  });
}