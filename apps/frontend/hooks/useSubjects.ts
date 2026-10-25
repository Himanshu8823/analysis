'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  subjectsService,
  type CreateSubjectPayload,
  type Subject,
  type SubjectListFilters,
  type SubjectOffering,
  type SubjectOfferingFilters,
  type SubjectOfferingPayload,
} from '@/lib/services/subjects.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from './useAuth';

/**
 * The subject catalogue.
 *
 * The list is small and changes rarely, so it is cached for five minutes —
 * the catalogue is reference data, not a live feed.
 */
export function useSubjects(filters?: SubjectListFilters) {
  return useQuery<Subject[]>({
    queryKey: queryKeys.subjects.list(filters),
    queryFn: () => subjectsService.list(filters),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * A single subject.
 *
 * The edit flow fetches the record on its own so it can be re-read fresh
 * rather than trusting whatever the list query happened to cache.
 */
export function useSubject(id: string | null) {
  return useQuery<Subject>({
    queryKey: id ? queryKeys.subjects.detail(id) : ['subjects', 'detail', 'noop'],
    queryFn: () => subjectsService.get(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * The subjects offered to a branch in a semester under a scheme.
 *
 * Disabled until every scope key is known — an unfiltered request would
 * return the whole college's catalogue to a branch-scoped HOD.
 */
export function useSubjectsByBranchSchemeSem(
  branchId: string,
  schemeId: string,
  semester: number,
) {
  return useQuery<Subject[]>({
    queryKey: queryKeys.subjects.byBranchSchemeSem(branchId, schemeId, semester),
    queryFn: () => subjectsService.list({ branchId, schemeId, semester }),
    enabled: !!branchId && !!schemeId && semester > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * The subject offerings — which subject is taught where, in which semester.
 *
 * This is the view that makes the semester structure visible: the catalogue
 * says *what* a subject is, the offerings say *where and when* it is taught.
 *
 * Named apart from `useAllocations.useSubjectOfferings`, which reads the
 * offerings off `GET /subjects` for the teacher-allocation picker. This one
 * reads the dedicated `GET /subject-offerings` resource.
 */
export function useSubjectCatalogueOfferings(filters?: SubjectOfferingFilters) {
  return useQuery<SubjectOffering[]>({
    queryKey: queryKeys.subjects.offerings(filters),
    queryFn: () => subjectsService.listOfferings(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSubject() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: CreateSubjectPayload) => subjectsService.create(payload),
    onSuccess: () => {
      invalidationRules.onSubjectChanged(qc);
      toast.success('Subject created');
    },
    onError: (error: unknown) => toast.error(extractErrorMessage(error)),
  });
}

export function useUpdateSubject() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateSubjectPayload> }) =>
      subjectsService.update(id, payload),
    onSuccess: () => {
      invalidationRules.onSubjectChanged(qc);
      toast.success('Subject updated');
    },
    onError: (error: unknown) => toast.error(extractErrorMessage(error)),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => subjectsService.delete(id),
    onSuccess: () => {
      invalidationRules.onSubjectChanged(qc);
      toast.success('Subject removed');
    },
    onError: (error: unknown) => toast.error(extractErrorMessage(error)),
  });
}

/**
 * Adds a subject to a class context — "this subject is taught to this branch,
 * in this semester, under this scheme".
 */
export function useCreateSubjectOffering() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: SubjectOfferingPayload) =>
      subjectsService.createOffering(payload),
    onSuccess: () => {
      invalidationRules.onSubjectChanged(qc);
      toast.success('Subject offered to the class');
    },
    onError: (error: unknown) => toast.error(extractErrorMessage(error)),
  });
}

/** Removes a subject from a class context. */
export function useDeleteSubjectOffering() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => subjectsService.deleteOffering(id),
    onSuccess: () => {
      invalidationRules.onSubjectChanged(qc);
      toast.success('Subject offering removed');
    },
    onError: (error: unknown) => toast.error(extractErrorMessage(error)),
  });
}
