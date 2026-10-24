'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { uploadService, type ConfirmEditsPayload, type UploadJob } from '@/lib/services/upload.service';
import { queryKeys } from '@/lib/query/queryKeys';
import { invalidationRules } from '@/lib/query/invalidationRules';
import { useToast } from '@/lib/utils/notifications';

export function useUploadFile() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (file: File) => uploadService.upload(file),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: queryKeys.upload.jobsList() });
      qc.setQueryData(queryKeys.upload.job(job.id), job);
      toast.success('Upload started — processing in background');
    },
    onError: () => toast.error('Upload failed. Try again.'),
  });
}

export function useUploadJob(jobId: string | null) {
  return useQuery<UploadJob>({
    queryKey: jobId ? queryKeys.upload.job(jobId) : ['upload', 'job', 'noop'],
    queryFn: () => uploadService.getJob(jobId!),
    enabled: !!jobId,
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
  return useMutation({
    mutationFn: ({ jobId, edits }: { jobId: string; edits: ConfirmEditsPayload }) =>
      uploadService.confirm(jobId, edits),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.upload.all() });
      invalidationRules.onStudentCreated(qc);
      toast.success('Upload confirmed and saved');
    },
    onError: () => toast.error('Failed to confirm upload'),
  });
}