import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface RankedTopper {
  rank: number;
  studentId: string;
  rollNo: string;
  name: string;
  score: number;
  percentage: number;
  isTie: boolean;
}

/** `GET /toppers/subject-wise` — per-subject winners with tie handling. */
export interface SubjectTopper {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  topperMarks: number;
  maxMarks: number;
  toppers: RankedTopper[];
}

/** `GET /toppers/class` — the class leaderboard. */
export interface ClassTopper {
  ranking: Array<{
    rank: number;
    studentId: string;
    rollNo: string;
    name: string;
    totalMarks: number;
    maxTotalMarks: number;
    percentage: number;
    creditsEarned: number;
  }>;
}

/** `GET /toppers/class?rankingRule=…` — leaderboard with an explicit rule. */
export interface ClassTopperByRule {
  /** The rule the backend applied — `marks`, `percentage` or `credits`. */
  rule: RankingRule;
  totalStudents: number;
  ranking: RankedTopper[];
}

/**
 * The ranking rules the backend understands.
 *
 * The API uses the lowercase names; `normaliseRankingRule` on the backend also
 * accepts the uppercase aliases, so both spellings work on the wire — but the
 * response always echoes the lowercase name.
 */
export type RankingRule = 'marks' | 'percentage' | 'credits';

export interface TopperFilters {
  branchId?: string;
  schemeId?: string;
  semester?: number;
  academicYearId?: string;
}

export interface ClassTopperFilters extends TopperFilters {
  rankingRule?: RankingRule;
  limit?: number;
}

export const toppersService = {
  subjectWise: async (filters: TopperFilters): Promise<SubjectTopper[]> => {
    const res = await apiClient.get(ENDPOINTS.TOPPERS.SUBJECT_WISE, {
      params: filters,
    });
    return res.data.data;
  },
  classToppers: async (
    filters: ClassTopperFilters,
  ): Promise<ClassTopperByRule | ClassTopper> => {
    const res = await apiClient.get(ENDPOINTS.TOPPERS.CLASS, { params: filters });
    return res.data.data;
  },
};
