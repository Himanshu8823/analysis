'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  allocationsService,
  type AssignableTeacher,
  type ClassNeedingTeacher,
  type ClassTeacherAssignment,
  type ClassTeacherAssignmentFilters,
  type CreateClassTeacherAssignmentPayload,
  type CreateTeacherAllocationPayload,
  type TeacherAllocation,
  type TeacherAllocationFilters,
} from '@/lib/services/allocations.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from './useAuth';
import {
  subjectOfferingsService,
  type SubjectOfferingFilters,
  type SubjectOfferingOption,
} from '@/lib/services/subject-offerings';

/**
 * The subject offerings a teacher can be allocated to.
 *
 * Disabled until a branch is known — the offering list is always branch
 * scoped, so an unfiltered request would leak another branch's catalogue.
 */
export function useSubjectOfferings(filters?: SubjectOfferingFilters) {
  return useQuery<SubjectOfferingOption[]>({
    queryKey: queryKeys.teacherAllocations.offeringOptions(filters),
    queryFn: () => subjectOfferingsService.list(filters),
    enabled: !!filters?.branchId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * The teachers who can be allocated teaching work.
 *
 * The list comes from the branch-scoped `assignable-teachers` endpoint rather
 * than from the member list: the member list is guarded by `users:read`,
 * which the HOD does not hold, and it carries every account in the college
 * when it is held. A teacher whose role is not bound to a branch (an
 * institution-wide teacher) is assignable within any branch, and the server
 * handles that.
 */
export function useAssignableTeachers(branchId?: string) {
  return useQuery<AssignableTeacher[]>({
    queryKey: queryKeys.teacherAllocations.assignableTeachers(branchId),
    queryFn: () => allocationsService.listAssignableTeachers(branchId),
    enabled: !!branchId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * The subject-to-teacher allocations for a scope (branch / semester / year).
 *
 * The query is disabled until a scope is known, because an unfiltered request
 * would return the whole college's allocations to a branch-scoped HOD.
 */
export function useTeacherAllocations(filters?: TeacherAllocationFilters) {
  return useQuery<TeacherAllocation[]>({
    queryKey: queryKeys.teacherAllocations.list(filters),
    queryFn: () => allocationsService.listTeacherAllocations(filters),
    enabled: !!filters?.branchId,
    staleTime: 60 * 1000,
  });
}

/**
 * The class-teacher assignments for a scope (branch / semester / year).
 *
 * Disabled until a scope is known — same reason as `useTeacherAllocations`.
 */
export function useClassTeacherAssignments(filters?: ClassTeacherAssignmentFilters) {
  return useQuery<ClassTeacherAssignment[]>({
    queryKey: queryKeys.classTeacherAssignments.list(filters),
    queryFn: () => allocationsService.listClassTeacherAssignments(filters),
    enabled: !!filters?.branchId,
    staleTime: 60 * 1000,
  });
}

/**
 * The classes that have students but no class teacher.
 *
 * This is the "class teacher required" state. It becomes non-empty when a
 * member who was a class teacher is revoked, and it is what keeps that gap
 * visible until somebody is appointed.
 */
export function useClassesNeedingTeacher(filters?: ClassTeacherAssignmentFilters) {
  return useQuery<ClassNeedingTeacher[]>({
    queryKey: queryKeys.classTeacherAssignments.needsTeacher(filters),
    queryFn: () => allocationsService.listClassesNeedingTeacher(filters),
    enabled: !!filters?.branchId,
    staleTime: 60 * 1000,
  });
}

/**
 * Allocates a subject offering to a teacher.
 *
 * The subject is referenced by its offering id, because a subject is offered
 * per branch / semester / scheme and it is the offering a teacher teaches.
 */
export function useCreateTeacherAllocation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: CreateTeacherAllocationPayload) =>
      allocationsService.createTeacherAllocation(payload),
    onSuccess: () => {
      invalidationRules.onTeacherAllocationChanged(qc);
      toast.success('Teacher allocated to the subject');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/** Removes a subject-to-teacher allocation. */
export function useDeleteTeacherAllocation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => allocationsService.deleteTeacherAllocation(id),
    onSuccess: () => {
      invalidationRules.onTeacherAllocationChanged(qc);
      toast.success('Allocation removed');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/**
 * Names a class teacher for a class context.
 *
 * A class has exactly one class teacher, so the backend rejects a second
 * assignment for the same class — replacing one is a delete followed by a
 * create.
 */
export function useCreateClassTeacherAssignment() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: CreateClassTeacherAssignmentPayload) =>
      allocationsService.createClassTeacherAssignment(payload),
    onSuccess: () => {
      invalidationRules.onClassTeacherAssignmentChanged(qc);
      toast.success('Class teacher assigned');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/** Removes a class-teacher assignment. */
export function useDeleteClassTeacherAssignment() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => allocationsService.deleteClassTeacherAssignment(id),
    onSuccess: () => {
      invalidationRules.onClassTeacherAssignmentChanged(qc);
      toast.success('Class teacher removed');
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}
