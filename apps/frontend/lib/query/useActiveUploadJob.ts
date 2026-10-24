'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * The id of the upload job the user is currently working on.
 *
 * This is client state, not server data — but it still belongs in the React
 * Query cache rather than a component's `useState`. A `useState` value dies
 * with the component, so navigating away from the upload page and back would
 * lose the job that is being processed and force the user to upload again.
 * Keeping it in the cache makes it survive navigation while still being
 * invalidated along with the rest of the upload domain.
 */
const ACTIVE_JOB_KEY = ['upload', 'active-job'] as const;

/**
 * Reads the active upload job id from the cache.
 *
 * The query is disabled — there is nothing to fetch — but React Query still
 * serves the cached value, which is exactly what is needed here.
 */
export function useActiveUploadJobId(): string | null {
  const { data } = useQuery<string | null>({
    queryKey: ACTIVE_JOB_KEY,
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000, // a day
  });
  return data ?? null;
}

/**
 * Stores (or clears) the active upload job id.
 */
export function useSetActiveUploadJobId(): (jobId: string | null) => void {
  const qc = useQueryClient();
  return (jobId: string | null) => {
    qc.setQueryData(ACTIVE_JOB_KEY, jobId);
  };
}
