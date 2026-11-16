'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  examinationsService,
  type CreateExaminationPayload,
  type Examination,
  type ExaminationFilters,
} from '@/lib/services/examinations.service';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from './useAuth';

/**
 * The examinations, with how ready each result is to be published.
 */
export function useExaminations(filters?: ExaminationFilters) {
  return useQuery<Examination[]>({
    queryKey: ['examinations', 'list', filters ?? null],
    queryFn: () => examinationsService.list(filters),
    enabled: !!filters?.branchId,
    staleTime: 60 * 1000,
  });
}

/**
 * Publishes a class's result.
 *
 * This is the act that turns a working sheet of marks into the college's
 * answer. The server refuses it unless every student's result is in, and
 * says how many are missing when it refuses.
 */
export function usePublishExamination() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => examinationsService.publish(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['examinations'] });
      toast.success('The result is published. It is now the college’s answer.');
    },
    onError: (error: unknown) => toast.error(extractErrorMessage(error)),
  });
}

/**
 * Returns a published result to being worked on.
 *
 * For the case where a mark was found to be wrong after the result went
 * out. The marks are not changed by this — a correction is a separate act.
 */
export function useUnpublishExamination() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => examinationsService.unpublish(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['examinations'] });
      toast.success('The result is back to being worked on.');
    },
    onError: (error: unknown) => toast.error(extractErrorMessage(error)),
  });
}

/**
 * Opens an examination for a class.
 */
export function useCreateExamination() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: CreateExaminationPayload) => examinationsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['examinations'] });
      toast.success('The examination is open. Its result can be published once the marks are in.');
    },
    onError: (error: unknown) => toast.error(extractErrorMessage(error)),
  });
}
