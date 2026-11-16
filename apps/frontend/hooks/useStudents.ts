'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  studentsService,
  type Student,
  type StudentListFilters,
  type BulkImportScope,
  type StudentProfileView,
} from '@/lib/services/students.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import type { ListResponse } from '@/lib/types/api';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from './useAuth';

export function useStudents(filters?: StudentListFilters) {
  return useQuery<ListResponse<Student>>({
    queryKey: queryKeys.students.list(filters),
    queryFn: () => studentsService.list(filters),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
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

/**
 * The student's whole profile.
 *
 * The server decides what this caller receives — a section they may not
 * read is absent from the payload — so the screen renders what it is given
 * and explains what it is not given.
 */
export function useStudentProfile(id: string | null) {
  return useQuery<StudentProfileView>({
    queryKey: id ? queryKeys.students.profile(id) : ['students', 'profile', 'noop'],
    queryFn: () => studentsService.getProfile(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

/**
 * Provisions a login for one student.
 *
 * The temporary password comes back exactly once, so the screen shows it
 * for the clerk to read out — and says so plainly rather than letting the
 * clerk believe it was emailed.
 */
export function useProvisionStudentLogin() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, email }: { id: string; email?: string }) =>
      studentsService.provisionLogin(id, email),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      if (result.created) {
        toast.success('Login created. The temporary password is shown once.');
      } else {
        toast.success('An existing account was linked to this student.');
      }
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}

/**
 * Provisions logins for a whole class, or for a selected set of students.
 */
export function useBulkProvisionStudentLogins() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (scope: {
      branchId?: string;
      semester?: number;
      schemeId?: string;
      academicYearId?: string;
      studentIds?: string[];
      skipMissingEmail?: boolean;
    }) => studentsService.bulkProvisionLogins(scope),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      const parts = [`${result.created} created`];
      if (result.linked) parts.push(`${result.linked} linked`);
      if (result.skipped) parts.push(`${result.skipped} skipped`);
      if (result.failures.length) parts.push(`${result.failures.length} failed`);
      toast.success(`Logins provisioned — ${parts.join(', ')}`);
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
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
    onError: (error) => toast.error(extractErrorMessage(error)),
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
    onError: (error) => toast.error(extractErrorMessage(error)),
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
    onError: (error) => toast.error(extractErrorMessage(error)),
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
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
}