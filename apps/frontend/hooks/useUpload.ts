'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadService, type ConfirmPayload, type UploadJob } from '@/lib/services/upload.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import {
  useActiveUploadJobId,
  useSetActiveUploadJobId,
} from '@/lib/query/useActiveUploadJob';
import { useToast } from '@/lib/utils/notifications';

export function useCreateUploadJob() {
  const qc = useQueryClient();
  const toast = useToast();
  const setActiveJobId = useSetActiveUploadJobId();
  return useMutation({
    mutationFn: uploadService.upload,
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: queryKeys.upload.jobsList() });
      qc.setQueryData(queryKeys.upload.job(job.id), job);
      // The new job becomes the active one, so leaving the page and coming
      // back resumes it instead of starting over.
      setActiveJobId(job.id);
      toast.success('Upload started — processing in background');
    },
    onError: () => toast.error('Upload failed. Try again.'),
  });
}

/**
 * The upload job currently being worked on.
 *
 * The job id lives in the React Query cache rather than component state, so
 * navigating away and back resumes the same job. The job itself is fetched
 * fresh when it is still processing, and served from the cache when it has
 * already finished — the server does not need to be asked again for a result
 * the client already has.
 */
export function useUploadJob(jobId?: string | null) {
  const activeJobId = useActiveUploadJobId();
  const id = jobId ?? activeJobId;

  return useQuery<UploadJob>({
    queryKey: id ? queryKeys.upload.job(id) : ['upload', 'job', 'noop'],
    queryFn: () => uploadService.getJob(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'PENDING' || status === 'PROCESSING') {
        return 2000;
      }
      return false;
    },
  });
}

export function useConfirmUpload() {
  const qc = useQueryClient();
  const toast = useToast();
  const setActiveJobId = useSetActiveUploadJobId();
  return useMutation({
    mutationFn: ({ jobId, payload }: { jobId: string; payload: ConfirmPayload }) =>
      uploadService.confirm(jobId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.upload.all() });
      invalidationRules.onStudentCreated(qc);
      // The job is done — there is nothing left to resume.
      setActiveJobId(null);
      toast.success('Upload confirmed and saved');
    },
    onError: () => toast.error('Failed to confirm upload'),
  });
}
