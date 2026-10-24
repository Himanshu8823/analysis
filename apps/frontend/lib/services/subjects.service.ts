import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

/** One exam component of a subject — how its total splits. */
export interface SubjectComponent {
  type: string;
  maxMarks: number;
  weightage?: number;
}

export interface Subject {
  id: string;
  branchId: string;
  schemeId: string;
  semester: number;
  code: string;
  name: string;
  credits: number;
  maxMarks: number;
  /** The curriculum year the subject belongs to. */
  year: number;
  /** Marks required to pass the subject. */
  passingMarks: number;
  components?: SubjectComponent[];
  isActive?: boolean;
}

export interface SubjectListFilters {
  branchId?: string;
  schemeId?: string;
  semester?: number;
}

/** The body `POST /subjects` accepts — every required field included. */
export type CreateSubjectPayload = Omit<Subject, 'id' | 'isActive' | 'components'> & {
  components?: SubjectComponent[];
  isActive?: boolean;
};

export const subjectsService = {
  /** The backend returns a plain array for subjects (no pagination). */
  list: async (filters?: SubjectListFilters): Promise<Subject[]> => {
    const res = await apiClient.get(ENDPOINTS.SUBJECTS.LIST, { params: filters });
    return res.data.data;
  },
  create: async (payload: CreateSubjectPayload) => {
    const res = await apiClient.post(ENDPOINTS.SUBJECTS.CREATE, payload);
    return res.data.data;
  },
  /** The backend exposes `PUT /subjects/:id`, not `PATCH`. */
  update: async (id: string, payload: Partial<CreateSubjectPayload>) => {
    const res = await apiClient.put(ENDPOINTS.SUBJECTS.UPDATE(id), payload);
    return res.data.data;
  },
  delete: async (id: string) => {
    await apiClient.delete(ENDPOINTS.SUBJECTS.DELETE(id));
  },
};