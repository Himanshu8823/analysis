'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marksService, type Mark, type MarkListFilters, type BulkMarkInput } from '@/lib/services/marks.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from './useAuth';

export function useMarks(filters?: MarkListFilters) {
  return useQuery<Mark[]>({
    queryKey: queryKeys.marks.list(filters),
    queryFn: () => marksService.list(filters),
    staleTime: 60 * 1000,
  });
}

export function useMarksByStudent(studentId: string | null) {
  return useQuery<Mark[]>({
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
      // The offering's own list is stale too — the grid it was read from
      // has just changed.
      qc.invalidateQueries({ queryKey: queryKeys.marks.all() });
      toast.success(`${variables.length} marks entries saved`);
    },
    onError: (error: unknown) => toast.error(extractErrorMessage(error)),
  });
}

export function useUpdateMark() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<
        Omit<BulkMarkInput, 'studentId' | 'subjectOfferingId' | 'examType' | 'academicYearId'>
      >;
    }) => marksService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.marks.all() });
      toast.success('Mark updated');
    },
    onError: (error: unknown) => toast.error(extractErrorMessage(error)),
  });
}

export function useCalculateMarks() {
  return useMutation({
    mutationFn: (payload: { studentId: string; academicYearId: string }) =>
      marksService.calculate(payload),
  });
}