import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export type UploadStatus = 'PENDING' | 'PROCESSING' | 'EXTRACTED' | 'COMPLETED' | 'FAILED';

export interface UploadJob {
  id: string;
  status: UploadStatus;
  fileName: string;
  createdAt: string;
  errorMessage?: string;
  extractedRows?: Array<Record<string, unknown>>;
}

export interface ConfirmEditsPayload {
  rows: Array<Record<string, unknown>>;
}

export const uploadService = {
  upload: async (file: File): Promise<UploadJob> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(ENDPOINTS.UPLOAD.CREATE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
  getJob: async (jobId: string): Promise<UploadJob> => {
    const res = await apiClient.get(ENDPOINTS.UPLOAD.GET_JOB(jobId));
    return res.data.data;
  },
  confirm: async (jobId: string, edits: ConfirmEditsPayload) => {
    const res = await apiClient.post(ENDPOINTS.UPLOAD.CONFIRM(jobId), edits);
    return res.data.data;
  },
};