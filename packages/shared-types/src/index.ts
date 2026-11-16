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

/**
 * How much authority each role carries, from the most to the least.
 *
 * The order matters in one place only: deciding whether a member may hand
 * out a role. A member may hand out a role that carries **strictly less**
 * authority than the strongest role they hold themselves. The order is not
 * a claim about how the college is organised — it is a claim about what each
 * role can do, and the permissions are what carry that.
 */
export const ROLE_AUTHORITY: readonly UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'HOD',
  'PRINCIPAL',
  'TEACHER',
  'STUDENT',
] as const;

/**
 * Whether a member holding `heldRoles` may hand out `roleToGrant`.
 *
 * The rules, in the words the screens use:
 *
 *  - the Super Admin role is never handed out through these screens — it is
 *    set by the system administrator alone;
 *  - a member may hand out a **staff** role — Admin, HOD, Principal or
 *    Teacher — only if it carries **strictly less** authority than the
 *    strongest role they hold. Handing out your own rank would make every
 *    office self-perpetuating: an Admin who could appoint an Admin could
 *    appoint an Admin who appoints Admins, and the exam cell would be beyond
 *    anybody's reach;
 *  - the **Student** role is appointed rather than granted as staff, and may
 *    be handed out only from the Principal level up. Appointing a student is
 *    not a teacher's act — a teacher teaches a subject — and the permission
 *    matrix agrees: the Teacher role carries no `rbac:write` at all.
 *
 * A member who holds several roles is judged by the **strongest** of them.
 * Judging by the weakest would let a Principal who also teaches appoint a
 * Student, which is not what their office means. The comparison is strict,
 * so a member may not appoint a peer: an Admin may not appoint another
 * Admin, and a Principal may not appoint another Principal.
 *
 * The backend enforces the same rule and is the authority on it. This copy
 * exists so the screens never offer a choice the backend would refuse — it
 * is the *offer*, not the decision.
 */
export function canGrantRole(heldRoles: readonly string[], roleToGrant: string): boolean {
  if (roleToGrant === 'SUPER_ADMIN') return false;

  const held = heldRoles.filter(isUserRole);
  if (held.length === 0) return false;
  if (!isUserRole(roleToGrant)) return false;

  const strongest = held.reduce((best, role) => {
    return ROLE_AUTHORITY.indexOf(role) < ROLE_AUTHORITY.indexOf(best) ? role : best;
  }, held[0]);

  if (roleToGrant === 'STUDENT') {
    return ROLE_AUTHORITY.indexOf(strongest) <= ROLE_AUTHORITY.indexOf('PRINCIPAL');
  }

  return ROLE_AUTHORITY.indexOf(roleToGrant) > ROLE_AUTHORITY.indexOf(strongest);
}

/**
 * The roles a member holding `heldRoles` may hand out.
 *
 * The Super Admin role is never in the list — it is not handed out through
 * these screens at all.
 */
export function grantableRoles(heldRoles: readonly string[]): UserRole[] {
  return USER_ROLES.filter(
    (role) => role !== 'SUPER_ADMIN' && canGrantRole(heldRoles, role),
  );
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

// Scheme Reading
/**
 * The kind of course a row of a syllabus table describes.
 *
 * The list is closed because a course type is a category the college uses
 * when it builds its curriculum — an unknown type is a reading error, not a
 * new category.
 */
export type CourseType = 'BSC' | 'ESC' | 'PCC' | 'VSEC' | 'AEC' | 'CC' | 'IKS' | 'MDC' | 'MIC';

export const COURSE_TYPES: readonly CourseType[] = [
  'BSC',
  'ESC',
  'PCC',
  'VSEC',
  'AEC',
  'CC',
  'IKS',
  'MDC',
  'MIC',
] as const;

/**
 * How a course is assessed.
 *
 * The three components a DBATU scheme table names:
 *
 *  - `CA` — Continuous Assessment, the internal marks.
 *  - `MSE` — Mid-Semester Examination.
 *  - `ESE` — End-Semester Examination.
 */
export type AssessmentComponent = 'CA' | 'MSE' | 'ESE';

export const ASSESSMENT_COMPONENTS: readonly AssessmentComponent[] = ['CA', 'MSE', 'ESE'] as const;

/**
 * One course, as read out of a syllabus PDF.
 *
 * Every field the syllabus prints is here, and every field that the syllabus
 * does not print is `null` — never zero. A dash in the table means "this
 * course has no mid-semester exam", which is not the same as "this course
 * has a mid-semester exam worth zero marks".
 */
export interface SchemeCourse {
  /** The course code — `COEMD112`. */
  courseCode: string;
  /** The course name — `Set Theory and Logic`. */
  courseName: string;
  /** The kind of course. */
  courseType: CourseType | null;
  /**
   * The semester the course is taught in.
   *
   * `null` when the document did not say — which happens when a table has
   * no semester heading.
   */
  semester: number | null;
  /** The weekly lecture hours. */
  theoryHours: number | null;
  /** The weekly practical hours. */
  practicalHours: number | null;
  /** The marks the continuous assessment carries. */
  ca: number | null;
  /** The marks the mid-semester examination carries. */
  mse: number | null;
  /** The marks the end-semester examination carries. */
  ese: number | null;
  /** The credit count. */
  credits: number | null;
  /**
   * The alternatives a student may choose between.
   *
   * A co-curricular course lists its options in a single cell — `A. NSS`,
   * `B. NCC`, `C. Yoga Education` — and each student picks one. The options
   * are kept together with the course rather than split into separate
   * courses, because they are one choice, not three subjects.
   */
  options: string[];
  /** The page of the document the course was read from. */
  pageNumber: number | null;
}

/**
 * A whole syllabus, as read out of a PDF.
 */
export interface SchemeDocument {
  /** The courses the document lists. */
  courses: SchemeCourse[];
  /** The semesters the document covers. */
  semesters: number[];
  /** The pages the document had. */
  pageCount: number;
  /**
   * The things the reader could not make sense of.
   *
   * A row that did not read is reported here rather than dropped, so the
   * reviewer can see that something exists that the system could not
   * understand.
   */
  warnings: SchemeWarning[];
}

/**
 * Something the reader was unsure about.
 */
export interface SchemeWarning {
  /** The page the problem was on. */
  pageNumber: number | null;
  /**
   * What the reader saw.
   *
   * `null` when the problem is not about one particular course — a page
   * that could not be read at all, for instance.
   */
  subject: string | null;
  /** What went wrong, in words the reviewer can act on. */
  message: string;
  /** How serious it is. */
  severity: 'info' | 'warning' | 'error';
}
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
