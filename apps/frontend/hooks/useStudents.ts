'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  studentsService,
  type Student,
  type StudentListFilters,
  type BulkImportScope,
} from '@/lib/services/students.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import type { ListResponse } from '@/lib/types/api';
import { useToast } from '@/lib/utils/notifications';

export function useStudents(filters?: StudentListFilters) {
  return useQuery<ListResponse<Student>>({
    queryKey: queryKeys.students.list(filters),
    queryFn: () => studentsService.list(filters),
    staleTime: 60 * 1000,
  });
}

export function useStudent(id: string | null) {
  return useQuery<Student>({
    queryKey: id ? queryKeys.students.detail(id) : ['students', 'detail', 'noop'],
    queryFn: () => studentsService.get(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: Omit<Student, 'id'>) => studentsService.create(payload),
    onSuccess: () => {
      invalidationRules.onStudentCreated(qc);
      toast.success('Student added');
    },
    onError: () => toast.error('Failed to add student'),
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<Student, 'id'>> }) =>
      studentsService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      toast.success('Student updated');
    },
    onError: () => toast.error('Failed to update student'),
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => studentsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      toast.success('Student removed');
    },
    onError: () => toast.error('Failed to delete student'),
  });
}

export function useImportStudents() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ file, scope }: { file: File; scope?: BulkImportScope }) =>
      studentsService.bulkImportFile(file, scope),
    onSuccess: (result) => {
      invalidationRules.onStudentCreated(qc);
      if (result.failed > 0) {
        toast.warning(`Imported ${result.inserted} students (${result.failed} failed)`);
      } else {
        toast.success(`Imported ${result.inserted} students`);
      }
    },
    onError: () => toast.error('Failed to import students'),
  });
}