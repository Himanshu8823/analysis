import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

/**
 * One subject offered to a class.
 */
export interface StructureSubject {
  subjectOfferingId: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  /** The teacher allocated to teach it, when there is one. */
  teacherName: string | null;
}

/**
 * One class in the college's structure.
 */
export interface AcademicClass {
  branchId: string;
  branchName: string;
  branchCode: string;
  semester: number;
  schemeId: string;
  schemeName: string;
  academicYearId: string;
  academicYear: string;
  subjects: StructureSubject[];
  /** The class teacher, when the class has one. */
  classTeacherName: string | null;
  studentCount: number;
  studentsWithCompleteResult: number;
  /** Whether the class's result could be published. */
  isReadyToPublish: boolean;
}

export interface AcademicStructure {
  academicYears: Array<{
    id: string;
    year: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  }>;
  classes: AcademicClass[];
}

export const academicStructureService = {
  /**
   * The academic structure — every class, with what is taught to it and how
   * ready it is.
   */
  get: async (params?: { branchId?: string; academicYearId?: string }): Promise<AcademicStructure> => {
    const res = await apiClient.get(ENDPOINTS.ACADEMIC.STRUCTURE, { params });
    return res.data.data;
  },
};
