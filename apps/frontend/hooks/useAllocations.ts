'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  allocationsService,
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
import { usersService } from '@/lib/services/users.service';
import type { Member } from '@result-analysis/shared-types';

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
 * The members who can be allocated teaching work — the ones holding the
 * TEACHER role.
 *
 * The members endpoint filters server-side on the role, and the branch filter
 * is applied again on the client: a branch-scoped role assignment carries its
 * own `branchId`, and a teacher whose role is not bound to a branch (an
 * institution-wide teacher) is still assignable within any branch.
 */
export function useAssignableTeachers(branchId?: string) {
  return useQuery<Member[]>({
    queryKey: queryKeys.members.teachers(branchId),
    queryFn: async () => {
      const res = await usersService.listMembers({ role: 'TEACHER', pageSize: 100 });
      const members = res.items ?? [];
      if (!branchId) return members;

      return members.filter((member) =>
        member.roles.some(
          (role) =>
            role.roleName === 'TEACHER' &&
            (role.branchId === null ||
              role.branchId === undefined ||
              role.branchId === branchId),
        ),
      );
    },
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
