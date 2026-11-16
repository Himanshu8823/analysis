import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { ListResponse } from '@/lib/types/api';

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  branchId: string;
  schemeId: string;
  semester: number;
  batchId: string;
  academicYearId: string;
  isActive?: boolean;
  /** Where the student stands in the course. */
  status?: StudentStatus;
  /** The calendar year the student joined the course. */
  admissionYear?: number | null;
  /** The section (division) the student is in. */
  section?: string | null;
  /** The student's own mobile number. */
  phone?: string | null;
  email?: string | null;
}

export type StudentStatus = 'ACTIVE' | 'GRADUATED' | 'DROPPED_OUT' | 'ON_LEAVE';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'NOT_RECORDED';

export type BloodGroup =
  | 'A_POS'
  | 'A_NEG'
  | 'B_POS'
  | 'B_NEG'
  | 'AB_POS'
  | 'AB_NEG'
  | 'O_POS'
  | 'O_NEG'
  | 'NOT_RECORDED';

export type ReservedCategory = 'GENERAL' | 'SC' | 'ST' | 'OBC' | 'EWS' | 'NOT_RECORDED';

export type FeeCategory =
  | 'REGULAR'
  | 'MANAGEMENT_QUOTA'
  | 'NRI'
  | 'CONCESSION'
  | 'SCHOLARSHIP'
  | 'NOT_RECORDED';

export type GuardianRelation =
  | 'FATHER'
  | 'MOTHER'
  | 'GRANDFATHER'
  | 'GRANDMOTHER'
  | 'UNCLE'
  | 'AUNT'
  | 'SPOUSE'
  | 'SIBLING'
  | 'OTHER';

export interface StudentListFilters {
  branchId?: string;
  schemeId?: string;
  semester?: number;
  academicYearId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface BulkImportResult {
  inserted: number;
  failed: number;
  errors?: Array<{ row: number; error: string }>;
}

/** The scope applied to every row of an imported file. */
export interface BulkImportScope {
  branchId?: string;
  schemeId?: string;
  batchId?: string;
  academicYearId?: string;
  semester?: number;
}

export interface BulkImportRow {
  rollNo: string;
  name: string;
  branchId?: string;
  schemeId?: string;
  batchId?: string;
  academicYearId?: string;
  semester?: number;
}

// ---------------------------------------------------------------------------
// The profile view
//
// These types mirror the backend's profile views. A field the caller may
// not read is **absent** from the payload — so the type marks it optional,
// and the screen simply does not render a section it did not receive.
// ---------------------------------------------------------------------------

export interface StudentSensitiveIdentityView {
  nationalId: string | null;
  bloodGroup: BloodGroup | null;
}

export interface StudentGuardianView {
  name: string | null;
  relation: GuardianRelation | null;
  phone: string | null;
  email: string | null;
  occupation: string | null;
}

export interface StudentGuardiansView {
  primary: StudentGuardianView | null;
  secondary: StudentGuardianView | null;
}

export interface StudentIdentityView {
  id: string;
  rollNo: string;
  name: string;
  photoUrl: string | null;
  initials: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  schemeId: string;
  schemeName: string;
  batchId: string;
  batchName: string;
  semester: number;
  currentYear: number;
  academicYearId: string;
  academicYear: string;
  admissionYear: number | null;
  section: string | null;
  email: string | null;
  hasLogin: boolean;
  phone: string | null;
  alternateEmail: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  reservedCategory: ReservedCategory | null;
  feeCategory: FeeCategory | null;
  scholarshipRecipient: boolean;
  status: StudentStatus;
  statusReason: string | null;
  statusDate: string | null;
  /** Present only for a caller entitled to the sensitive identity data. */
  sensitive?: StudentSensitiveIdentityView;
  /** Present only for a caller entitled to the guardian details. */
  guardians?: StudentGuardiansView;
}

export interface StudentEnrolledSubjectView {
  subjectOfferingId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  maxMarks: number;
  passingMarks: number;
}

export interface StudentAcademicSnapshotView {
  semester: number;
  academicYearId: string;
  academicYear: string;
  subjects: StudentEnrolledSubjectView[];
  totalCredits: number;
  earnedCredits: number;
  aggregate: number | null;
  grade: string | null;
  isPass: boolean | null;
  isEvaluated: boolean;
  failedSubjects?: Array<{ subjectCode: string; subjectName: string; reason: string }>;
}

export interface StudentMarkComponentView {
  examType: string;
  marksObtained: number;
  maxMarks: number;
  isAbsent: boolean;
  isWithheld: boolean;
  remarks: string | null;
}

export interface StudentSubjectMarksView {
  subjectOfferingId: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  academicYearId: string;
  academicYear: string;
  credits: number;
  maxMarks: number;
  passingMarks: number;
  totalObtained: number;
  totalMax: number;
  percentage: number | null;
  isPass: boolean | null;
  reason: string | null;
  components: StudentMarkComponentView[];
}

export interface StudentMarksHistoryGroup {
  semester: number;
  academicYearId: string;
  academicYear: string;
  subjects: StudentSubjectMarksView[];
}

export interface StudentResultHistoryEntryView {
  semester: number;
  academicYearId: string;
  academicYear: string;
  schemeName: string;
  totalMarks: number;
  maxTotalMarks: number;
  aggregate: number | null;
  grade: string | null;
  creditsEarned: number;
  totalCredits: number;
  isPass: boolean | null;
  examinationStatus: string | null;
  examinationName: string | null;
  resultPublishedAt: string | null;
}

export interface StudentDocumentView {
  id: string;
  kind: string;
  title: string;
  createdAt: string;
  status: string;
  fileUrl: string | null;
}

export interface StudentActivityView {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string;
  details: string | null;
}

export interface StudentProfileView {
  identity: StudentIdentityView;
  academic?: StudentAcademicSnapshotView;
  marksHistory?: StudentMarksHistoryGroup[];
  resultHistory?: StudentResultHistoryEntryView[];
  documents?: StudentDocumentView[];
  activity?: StudentActivityView[];
  availableActions: string[];
  restrictedNotice?: string;
}

/** The outcome of a bulk login-provisioning run. */
export interface BulkProvisionResult {
  created: number;
  linked: number;
  skipped: number;
  accounts: Array<{
    studentId: string;
    studentName: string;
    rollNo: string;
    email: string;
    temporaryPassword: string | null;
  }>;
  failures: Array<{ studentId: string; rollNo: string; reason: string }>;
}

export const studentsService = {
  list: async (filters?: StudentListFilters): Promise<ListResponse<Student>> => {
    const res = await apiClient.get(ENDPOINTS.STUDENTS.LIST, { params: filters });
    return res.data.data;
  },
  get: async (id: string): Promise<Student> => {
    const res = await apiClient.get(ENDPOINTS.STUDENTS.GET(id));
    return res.data.data;
  },
  /**
   * The whole profile of one student.
   *
   * The server decides what this caller receives: a section they may not
   * read is absent from the payload, not present and empty.
   */
  getProfile: async (id: string): Promise<StudentProfileView> => {
    const res = await apiClient.get(ENDPOINTS.STUDENTS.PROFILE(id));
    return res.data.data;
  },
  create: async (payload: Omit<Student, 'id'>) => {
    const res = await apiClient.post(ENDPOINTS.STUDENTS.CREATE, payload);
    return res.data.data;
  },
  /** The backend exposes `PUT /students/:id`, not `PATCH`. */
  update: async (id: string, payload: Partial<Omit<Student, 'id'>>) => {
    const res = await apiClient.put(ENDPOINTS.STUDENTS.UPDATE(id), payload);
    return res.data.data;
  },
  delete: async (id: string) => {
    await apiClient.delete(ENDPOINTS.STUDENTS.DELETE(id));
  },
  /** Imports students from JSON rows — the scope may be sent per row or once. */
  bulkImport: async (
    rows: BulkImportRow[],
    scope?: BulkImportScope,
  ): Promise<BulkImportResult> => {
    const res = await apiClient.post(ENDPOINTS.STUDENTS.BULK_IMPORT, {
      rows,
      ...scope,
    });
    return res.data.data;
  },
  /**
   * Imports students from an uploaded CSV or Excel sheet. The scope travels as
   * query parameters because a multipart body cannot carry nested JSON.
   */
  bulkImportFile: async (
    file: File,
    scope?: BulkImportScope,
  ): Promise<BulkImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(ENDPOINTS.STUDENTS.BULK_IMPORT_FILE, formData, {
      params: scope,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
  },
  /**
   * Provisions a login for one student.
   *
   * The temporary password comes back exactly once — it is never stored in
   * plaintext and never emailed — so the screen shows it for the clerk to
   * read out.
   */
  provisionLogin: async (
    id: string,
    email?: string,
  ): Promise<{
    studentId: string;
    studentName: string;
    rollNo: string;
    email: string;
    userId: string;
    created: boolean;
    temporaryPassword: string | null;
  }> => {
    const res = await apiClient.post(ENDPOINTS.STUDENTS.PROVISION_LOGIN(id), { email });
    return res.data.data;
  },
  /**
   * Provisions logins for a whole class, or for a selected set of students.
   */
  bulkProvisionLogins: async (scope: {
    branchId?: string;
    semester?: number;
    schemeId?: string;
    academicYearId?: string;
    studentIds?: string[];
    skipMissingEmail?: boolean;
  }): Promise<BulkProvisionResult> => {
    const res = await apiClient.post(ENDPOINTS.STUDENTS.BULK_PROVISION_LOGINS, scope);
    return res.data.data;
  },
};
