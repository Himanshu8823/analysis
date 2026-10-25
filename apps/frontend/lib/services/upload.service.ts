import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export type UploadStatus = 'PENDING' | 'PROCESSING' | 'EXTRACTED' | 'COMPLETED' | 'FAILED';

/** The file types the backend registers jobs for. */
export type UploadFileType = 'EXCEL' | 'PDF_TEXT' | 'PDF_IMAGE' | 'CSV';

/** One extracted mark row — exactly the fields the confirm DTO accepts. */
export interface ExtractedMarkRow {
  rollNo: string;
  subjectCode: string;
  examType: string;
  marksObtained: number;
  maxMarks: number;
  isAbsent?: boolean;
}

export interface UploadJob {
  id: string;
  status: UploadStatus;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  errorMessage?: string | null;
  createdAt: string;
  /** Who raised the upload — present on the list endpoint. */
  uploadedBy?: string;
  uploadedByUser?: { id: string; email: string; name: string } | null;
  extractedData?: {
    /** The mark rows the backend extracted from the file. */
    rows?: ExtractedMarkRow[];
    /** Rows the parser could not read, with the spreadsheet row number. */
    errors?: Array<{ row: number; error: string }>;
    totalRows?: number;
    errorCount?: number;
  } | null;
}

/** The page metadata the list endpoint returns alongside the rows. */
export interface UploadJobListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Filters accepted by the upload list endpoint. */
export interface UploadJobFilters {
  page?: number;
  pageSize?: number;
  status?: UploadStatus;
  /** Narrows to one member's jobs. The server may force this to the caller. */
  uploadedBy?: string;
}

/** The scope a confirmation is applied against. */
export interface UploadScope {
  branchId: string;
  schemeId: string;
  semester: number;
  academicYearId: string;
}

export interface ConfirmPayload {
  rows: ExtractedMarkRow[];
  metadata: UploadScope;
}

export const uploadService = {
  /**
   * Uploads the file and registers the parsing job in one call.
   *
   * The browser cannot hand the server a usable URL for a local file, so the
   * bytes go up as multipart and the backend stores them before creating the
   * job.
   */
  upload: async (file: File): Promise<UploadJob> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(ENDPOINTS.UPLOAD.UPLOAD_FILE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
  /**
   * Registers an upload job for a file that is already at a URL (for example
   * one uploaded straight to object storage).
   */
  create: async (payload: {
    fileName: string;
    fileType: UploadFileType;
    fileUrl: string;
    fileSize: number;
    metadata?: Partial<UploadScope>;
  }): Promise<UploadJob> => {
    const res = await apiClient.post(ENDPOINTS.UPLOAD.CREATE, payload);
    return res.data.data;
  },
  getJob: async (jobId: string): Promise<UploadJob> => {
    const res = await apiClient.get(ENDPOINTS.UPLOAD.GET_JOB(jobId));
    return res.data.data;
  },
  confirm: async (jobId: string, payload: ConfirmPayload) => {
    const res = await apiClient.post(ENDPOINTS.UPLOAD.CONFIRM(jobId), payload);
    return res.data.data;
  },
  /**
   * The upload jobs the caller may read.
   *
   * The exam cell sees every job in the college; everyone else sees only
   * the jobs they raised themselves. The server decides — the `uploadedBy`
   * filter narrows within that set and never widens it.
   */
  list: async (
    filters: UploadJobFilters = {}
  ): Promise<{ items: UploadJob[]; meta: UploadJobListMeta }> => {
    const res = await apiClient.get(ENDPOINTS.UPLOAD.JOBS, { params: filters });
    return res.data.data;
  },
};
