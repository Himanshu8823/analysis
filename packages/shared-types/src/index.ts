// ============================================================================
// Shared Types - Source of truth across frontend, backend, workers
// ============================================================================

// User & Auth
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'HOD' | 'TEACHER' | 'PRINCIPAL' | 'STUDENT';

/** Every role the system knows about, in privilege order. */
export const USER_ROLES: readonly UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'HOD',
  'PRINCIPAL',
  'TEACHER',
  'STUDENT',
] as const;

/**
 * Roles that may be granted through an invitation.
 *
 * `SUPER_ADMIN` is excluded on purpose: the Super Admin must not be able to
 * mint a second Super Admin through the invite flow.
 */
export const INVITABLE_ROLES: readonly UserRole[] = [
  'ADMIN',
  'HOD',
  'PRINCIPAL',
  'TEACHER',
  'STUDENT',
] as const;

/** Roles whose authority is scoped to a single branch. */
export const BRANCH_SCOPED_ROLES: readonly UserRole[] = [
  'HOD',
  'PRINCIPAL',
  'TEACHER',
] as const;

/** Narrows an arbitrary string from the database to a known role name. */
export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  branchId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Invites & Members
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface Invite {
  id: string;
  email: string;
  name: string;
  roleName: UserRole;
  branchId?: string | null;
  status: InviteStatus;
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
  /**
   * Set when a resend replaced this invitation. The record is kept for the
   * history, but the link is dead — it is not a live invitation.
   */
  supersededById?: string | null;
  /** Present only on the create/resend response — lets an admin copy the link manually. */
  inviteUrl?: string;
}

export interface MemberRole {
  roleName: UserRole;
  branchId?: string | null;
}

export interface Member {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: MemberRole[];
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

// Academic
export interface Branch {
  id: string;
  code: string; // CS, ME, CE, EE
  name: string;
  isActive: boolean;
}

export type SchemeName = 'SCHEME_2019' | 'SCHEME_2022' | 'SCHEME_2024';

export interface Scheme {
  id: string;
  name: SchemeName;
  description: string;
  rules: SchemeRules;
  isActive: boolean;
}

export interface SchemeRules {
  passingPercentage: number;
  graceMarks: number;
  components: ExamComponent[];
  // Scheme-specific overrides
  [key: string]: unknown;
}

export interface ExamComponent {
  type: ExamType;
  maxMarks: number;
  passingMarks?: number;
  weightage?: number;
}

export type ExamType = 'CA1' | 'CA2' | 'MID_SEM' | 'WRITTEN' | 'PRACTICAL' | 'ORAL';

export interface Subject {
  id: string;
  code: string;
  name: string;
  credits: number;
  branchId: string;
  semester: number;
  schemeId: string;
  maxMarks: number;
  passingMarks: number;
  isActive: boolean;
}

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  branchId: string;
  currentYear: number;
  semester: number;
  schemeId: string;
  batchId: string;
  academicYearId: string;
  isActive: boolean;
}

export interface Mark {
  id: string;
  studentId: string;
  subjectId: string;
  examType: ExamType;
  marksObtained: number;
  maxMarks: number;
  isAbsent: boolean;
  academicYearId: string;
}

export interface CalculatedResult {
  studentId: string;
  subjectId: string;
  totalMarks: number;
  maxTotalMarks: number;
  percentage: number;
  creditsEarned: number;
  isPass: boolean;
  components: Array<{
    type: ExamType;
    obtained: number;
    max: number;
    isAbsent: boolean;
  }>;
}

// Upload Jobs
export type JobStatus = 'PENDING' | 'PROCESSING' | 'EXTRACTED' | 'FAILED' | 'COMPLETED';

export type FileType = 'EXCEL' | 'PDF_TEXT' | 'PDF_IMAGE';

export interface UploadJob {
  id: string;
  userId: string;
  fileName: string;
  fileType: FileType;
  fileUrl: string;
  status: JobStatus;
  progress: number;
  errorMessage?: string;
  extractedData?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

// Reports
export interface Report {
  id: string;
  generatedBy: string;
  type: ReportType;
  filters: Record<string, unknown>;
  fileUrl?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
}

export type ReportType =
  | 'STUDENT_WISE'
  | 'SCHEME_WISE'
  | 'SUBJECT_ANALYSIS'
  | 'STUDENT_ANALYSIS'
  | 'CLASS_TOPPERS'
  | 'PASS_FAIL'
  | 'COMPLETE';

// Audit
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
}

// API Response Wrappers
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}
