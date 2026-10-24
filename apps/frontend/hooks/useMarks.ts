'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marksService, type Mark, type MarkListFilters, type BulkMarkInput } from '@/lib/services/marks.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import { useToast } from '@/lib/utils/notifications';

export function useMarks(filters?: MarkListFilters) {
  return useQuery<{ data: Mark[] }>({
    queryKey: queryKeys.marks.list(filters),
    queryFn: () => marksService.list(filters),
    staleTime: 60 * 1000,
  });
}

export function useMarksByStudent(studentId: string | null) {
  return useQuery<{ data: Mark[] }>({
    queryKey: studentId ? queryKeys.marks.byStudent(studentId) : ['marks', 'student', 'noop'],
    queryFn: () => marksService.list({ studentId: studentId! }),
    enabled: !!studentId,
    staleTime: 60 * 1000,
  });
}

export function useCreateBulkMarks() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (marks: BulkMarkInput[]) => marksService.createBulk(marks),
    onSuccess: (_data, variables) => {
      const studentIds = Array.from(new Set(variables.map((m) => m.studentId)));
      studentIds.forEach((studentId) => {
        invalidationRules.onMarksUpdated(qc, studentId);
      });
      toast.success(`${variables.length} marks entries saved`);
    },
    onError: () => toast.error('Failed to save marks'),
  });
}

export function useUpdateMark() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BulkMarkInput> }) =>
      marksService.update(id, payload),
    onSuccess: (_data, vars) => {
      invalidationRules.onMarksUpdated(qc, vars.payload.studentId ?? '');
      toast.success('Mark updated');
    },
    onError: () => toast.error('Failed to update mark'),
  });
}

export function useCalculateMarks() {
  return useMutation({
    mutationFn: (payload: { studentId: string; schemeId: string }) => marksService.calculate(payload),
  });
}