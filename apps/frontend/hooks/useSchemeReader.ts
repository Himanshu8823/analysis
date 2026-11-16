'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  schemeReaderService,
  type SchemeConfirmPayload,
  type SchemeConfirmResult,
  type SchemeReadResult,
} from '@/lib/services/scheme-reader.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import { useToast } from '@/lib/utils/notifications';
import { extractErrorMessage } from '@/hooks/useAuth';

/**
 * Whether the automatic reading is available on this system.
 *
 * The result is cached for the length of a session's attention rather than
 * forever: a system gains its AI key on a restart, and the answer changes.
 * A stale answer that says "not available" would hide the button for ten
 * minutes after the key was added, so the shorter lifetime is deliberate.
 */
export function useSchemeReaderAvailability() {
  return useQuery({
    queryKey: queryKeys.schemeReader.availability(),
    queryFn: () => schemeReaderService.availability(),
    staleTime: 60 * 1000,
    retry: false,
  });
}

/**
 * Reads a syllabus PDF into courses for review.
 *
 * The result is *not* cached: a reading is a one-off look at a document, and
 * caching it would mean the review screen could show a stale proposal after
 * the reviewer re-reads the file. The reviewer holds the result in the
 * screen's own state, which is where the corrections live.
 */
export function useReadScheme() {
  const toast = useToast();
  return useMutation({
    mutationFn: ({
      file,
      scope,
    }: {
      file: File;
      scope: { branchId: string; academicYearId?: string };
    }) => schemeReaderService.readFile(file, scope),
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

/**
 * Writes the reviewed courses as subjects.
 *
 * On success the subject catalogue and the offerings are invalidated
 * together, because they are two views of the same structure — a subject is
 * the identity, an offering says where that identity is taught.
 */
export function useConfirmScheme() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (payload: SchemeConfirmPayload) => schemeReaderService.confirm(payload),
    onSuccess: (result: SchemeConfirmResult) => {
      invalidationRules.onSubjectChanged(qc);
      toast.success(
        `Saved ${result.created} new and ${result.updated} updated subject${
          result.created + result.updated === 1 ? '' : 's'
        }.`,
      );
    },
    onError: (error: unknown) => {
      toast.error(extractErrorMessage(error));
    },
  });
}
