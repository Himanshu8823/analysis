import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

/**
 * Subject-to-teacher allocation.
 *
 * One row means "this teacher teaches this subject offering in this academic
 * year". The offering already carries the branch, semester and scheme, so the
 * allocation itself does not repeat them — but the response repeats them as
 * flat fields so a list view never has to join the offering back.
 */
export interface TeacherAllocation {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  /** The offering the teacher was allocated for. */
  subjectOfferingId: string;
  semester: number;
  branchId: string;
  academicYearId: string;
}

export interface TeacherAllocationFilters {
  branchId?: string;
  semester?: number;
  academicYearId?: string;
}

/** The body `POST /teacher-allocations` accepts. */
export interface CreateTeacherAllocationPayload {
  teacherId: string;
  subjectOfferingId: string;
  academicYearId: string;
}

/**
 * A class-teacher assignment.
 *
 * A "class" is branch + semester + scheme + academic year, and it has exactly
 * one class teacher — the backend enforces that with a unique constraint, so
 * replacing a class teacher is a delete followed by a create.
 */
export interface ClassTeacherAssignment {
  id: string;
  branchId: string;
  semester: number;
  schemeId: string;
  academicYearId: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  assignedAt: string;
}

export interface ClassTeacherAssignmentFilters {
  branchId?: string;
  semester?: number;
  academicYearId?: string;
}

/** The body `POST /class-teacher-assignments` accepts. */
export interface CreateClassTeacherAssignmentPayload {
  teacherId: string;
  branchId: string;
  semester: number;
  schemeId: string;
  academicYearId: string;
}

export const allocationsService = {
  /**
   * Lists the subject-to-teacher allocations for a scope.
   *
   * The backend returns a plain array for allocations (no pagination).
   */
  listTeacherAllocations: async (
    filters?: TeacherAllocationFilters,
  ): Promise<TeacherAllocation[]> => {
    const res = await apiClient.get(ENDPOINTS.TEACHER_ALLOCATIONS.LIST, {
      params: filters,
    });
    return res.data.data;
  },

  createTeacherAllocation: async (
    payload: CreateTeacherAllocationPayload,
  ): Promise<TeacherAllocation> => {
    const res = await apiClient.post(ENDPOINTS.TEACHER_ALLOCATIONS.CREATE, payload);
    return res.data.data;
  },

  deleteTeacherAllocation: async (id: string): Promise<void> => {
    await apiClient.delete(ENDPOINTS.TEACHER_ALLOCATIONS.DELETE(id));
  },

  /**
   * Lists the class-teacher assignments for a scope.
   *
   * The backend returns a plain array for assignments (no pagination).
   */
  listClassTeacherAssignments: async (
    filters?: ClassTeacherAssignmentFilters,
  ): Promise<ClassTeacherAssignment[]> => {
    const res = await apiClient.get(ENDPOINTS.CLASS_TEACHER_ASSIGNMENTS.LIST, {
      params: filters,
    });
    return res.data.data;
  },

  createClassTeacherAssignment: async (
    payload: CreateClassTeacherAssignmentPayload,
  ): Promise<ClassTeacherAssignment> => {
    const res = await apiClient.post(ENDPOINTS.CLASS_TEACHER_ASSIGNMENTS.CREATE, payload);
    return res.data.data;
  },

  deleteClassTeacherAssignment: async (id: string): Promise<void> => {
    await apiClient.delete(ENDPOINTS.CLASS_TEACHER_ASSIGNMENTS.DELETE(id));
  },
};
