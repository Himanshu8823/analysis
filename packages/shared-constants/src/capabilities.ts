/**
 * The capability layer.
 *
 * This file is the single source of truth for "what may this member do, and
 * what may they see?" — and it is imported by **both** sides:
 *
 *  - the backend, to enforce a decision in the service layer;
 *  - the frontend, to hide a screen, a button or a column the member may not
 *    use.
 *
 * The rule that makes it work: *if a user cannot use a thing, they must not be
 * shown the thing*. A visible-but-403'd screen is already a leak — it tells
 * the member the record exists.
 *
 * When the two sides answer differently for the same question, that is a bug.
 * `capabilities.spec.ts` in the backend asserts that the frontend's own
 * navigation list and this catalogue agree.
 *
 * Everything here is data, not behaviour: no framework, no imports beyond the
 * permission catalogue above it.
 */

/** Every screen in the application, by route. */
export const SCREENS = {
  DASHBOARD: '/dashboard',
  MY_RESULT: '/my-result',
  UPLOAD: '/upload',
  UPLOAD_HISTORY: '/upload-history',
  STUDENTS: '/students',
  STUDENT_NEW: '/students/new',
  STUDENT_EDIT: '/students/:id/edit',
  STUDENT_IMPORT: '/students/import',
  /** Provisioning a whole class of student logins in one run. */
  STUDENT_BULK_PROVISION: '/students/bulk-provision',
  /**
   * The student's profile — the one screen that shows a single student's
   * whole academic journey.
   *
   * It is a distinct screen from the edit form: the profile is a *read*,
   * and what it shows depends on who is asking. The edit form is a *write*.
   */
  STUDENT_PROFILE: '/students/:id',
  MARKS: '/marks',
  MARK_CORRECTION: '/marks/correct',
  SUBJECTS: '/admin/subjects',
  SUBJECT_NEW: '/admin/subjects/new',
  SUBJECT_EDIT: '/admin/subjects/:id/edit',
  OFFERING_NEW: '/admin/subjects/offerings/new',
  ASSIGNMENTS: '/admin/assignments',
  CLASS_OVERVIEW: '/class-overview',
  REPORTS: '/reports',
  TOPPERS: '/toppers',
  ANALYTICS: '/analytics',
  MEMBERS: '/admin/members',
  MEMBER_NEW: '/admin/members/new',
  MEMBER_EDIT: '/admin/members/:id/edit',
  ROLES: '/admin/roles',
  SCHEMES: '/admin/schemes',
  SCHEME_NEW: '/admin/schemes/new',
  SCHEME_EDIT: '/admin/schemes/:id/edit',
  SCHEME_READ: '/admin/schemes/read',
  BRANCHES: '/admin/branches',
  ACADEMIC_YEARS: '/admin/academic-years',
  ACADEMIC_STRUCTURE: '/admin/academic-structure',
  PUBLICATIONS: '/admin/publications',
  AUDIT_LOG: '/admin/audit-log',
  MY_ACCOUNT: '/my-account',
  CHANGE_PASSWORD: '/change-password',
} as const;

export type Screen = (typeof SCREENS)[keyof typeof SCREENS];

/**
 * A screen's access rule.
 *
 * `permissions` is a list of permissions of which the member needs **at
 * least one** (`some`), matching the sidebar's existing behaviour: a member
 * holding several roles sees a screen as soon as *any* of their roles grants
 * it.
 *
 * `requiresAll` is for the rare screen that genuinely needs several
 * permissions at once.
 */
export interface ScreenCapability {
  /** The screen's path. */
  path: string;
  /** The label shown in the navigation. */
  label: string;
  /** At least one of these is enough. */
  permissions: string[];
  /** All of these are required, on top of `permissions`. */
  requiresAll?: string[];
  /** The navigation group the screen belongs to. */
  group: 'workspace' | 'admin';
  /** The icon name used by the sidebar. */
  icon?: string;
}

/**
 * The catalogue of screens and what they need.
 *
 * This is the authoritative list. The frontend's `NAV_ITEMS` and
 * `ADMIN_ITEMS` are checked against it by a test, so the two cannot drift.
 */
export const SCREEN_CAPABILITIES: readonly ScreenCapability[] = [
  {
    path: SCREENS.DASHBOARD,
    label: 'Dashboard',
    permissions: ['dashboard:read'],
    group: 'workspace',
    icon: 'home',
  },
  {
    path: SCREENS.MY_RESULT,
    label: 'My Result',
    permissions: ['marks:read_own'],
    group: 'workspace',
    icon: 'award',
  },
  {
    path: SCREENS.UPLOAD,
    label: 'Upload Results',
    permissions: ['upload:create'],
    group: 'workspace',
    icon: 'upload',
  },
  {
    path: SCREENS.UPLOAD_HISTORY,
    label: 'Upload History',
    permissions: ['upload:read'],
    group: 'workspace',
    icon: 'history',
  },
  {
    path: SCREENS.STUDENTS,
    label: 'Students',
    permissions: ['students:read'],
    group: 'workspace',
    icon: 'users',
  },
  /**
   * The student forms.
   *
   * A form is gated on the permission its **submission** needs, not on the
   * permission to see the list it sits behind. A member who may read the
   * roster but not add to it is refused the "add a student" screen — which
   * is exactly what the server does with the POST that follows. Gating the
   * form on the read permission would show a member a form whose every
   * submission is refused.
   */
  {
    path: SCREENS.STUDENT_NEW,
    label: 'Add student',
    permissions: ['students:write'],
    group: 'workspace',
    icon: 'users',
  },
  {
    path: SCREENS.STUDENT_EDIT,
    label: 'Edit student',
    permissions: ['students:write'],
    group: 'workspace',
    icon: 'users',
  },
  {
    path: SCREENS.STUDENT_IMPORT,
    label: 'Import students',
    permissions: ['students:write'],
    group: 'workspace',
    icon: 'users',
  },
  /**
   * Provisioning a whole class of student logins in one run.
   *
   * Its own screen and its own permission, because a bulk run creates a
   * hundred accounts at once — a materially larger act than editing one
   * record, and one the exam cell alone should be able to do.
   */
  {
    path: SCREENS.STUDENT_BULK_PROVISION,
    label: 'Give a class its logins',
    permissions: ['students:bulk_provision'],
    group: 'workspace',
    icon: 'users',
  },
  /**
   * The student's profile.
   *
   * A read, not a write — so it is gated on the *read* permission, not on
   * `students:write`. A Principal, who may see a student's whole academic
   * picture but may not change the record, must be able to open it.
   *
   * `students:read_own` is here as well, so a student can open their own
   * profile. The backend resolves "your own" from the session — there is no
   * id in the path that could address somebody else — so this grants a
   * student access to *their* profile and nothing more.
   *
   * ## Why this entry sits *after* the static student paths
   *
   * `/students/:id` matches any single segment after `/students/`, so it
   * also matches `/students/import` and `/students/bulk-provision`. The
   * catalogue is scanned in order and the **first** match wins, so a
   * parameterised pattern that came earlier would swallow the static
   * screens that follow it — and `/students/import` would be resolved as
   * "a student's profile" instead of "import students".
   *
   * The rule this file follows everywhere: **every static path comes before
   * every parameterised one** that could shadow it. `/students/new` and
   * `/students/:id/edit` are already ordered for the same reason.
   */
  {
    path: SCREENS.STUDENT_PROFILE,
    label: 'Student profile',
    permissions: ['students:read', 'students:read_own'],
    group: 'workspace',
    icon: 'users',
  },
  {
    /**
     * The marks of a class.
     *
     * The screen **opens** for a member who may read marks, because it is
     * where the marks of a class are — and the Head of Department and the
     * Principal are both entitled to read their marks. What they may not do
     * is change them, and the screen does not offer the editing to them.
     *
     * The screen used to ask for a write permission, which meant a member
     * who held `marks:read` was refused the marks they were entitled to
     * see — the permission had no screen behind it.
     */
    path: SCREENS.MARKS,
    label: 'Marks Entry',
    permissions: ['marks:read', 'marks:enter_own_subject', 'marks:write'],
    group: 'workspace',
    icon: 'file',
  },
  {
    /**
     * The examination cell's correction of a mark a teacher holds.
     *
     * A correction is a different operation from an ordinary entry — it
     * overwrites work another person is responsible for — so it has its own
     * screen and its own permission. A teacher never sees it.
     */
    path: SCREENS.MARK_CORRECTION,
    label: 'Correct a mark',
    permissions: ['marks:write'],
    group: 'workspace',
    icon: 'file',
  },
  {
    path: SCREENS.CLASS_OVERVIEW,
    label: 'Class Overview',
    permissions: ['class_teacher_assignments:read'],
    group: 'workspace',
    icon: 'users',
  },
  {
    path: SCREENS.REPORTS,
    label: 'Reports',
    permissions: ['reports:read'],
    group: 'workspace',
    icon: 'file',
  },
  {
    path: SCREENS.TOPPERS,
    label: 'Toppers',
    permissions: ['toppers:read', 'toppers:read_own_class'],
    group: 'workspace',
    icon: 'award',
  },
  {
    path: SCREENS.ANALYTICS,
    label: 'Analytics',
    permissions: ['analytics:read'],
    group: 'workspace',
    icon: 'chart',
  },
  {
    path: SCREENS.SUBJECTS,
    label: 'Subjects',
    permissions: ['subjects:read'],
    group: 'admin',
    icon: 'book',
  },
  {
    path: SCREENS.SUBJECT_NEW,
    label: 'Add subject',
    permissions: ['subjects:write'],
    group: 'admin',
    icon: 'book',
  },
  {
    path: SCREENS.SUBJECT_EDIT,
    label: 'Edit subject',
    permissions: ['subjects:write'],
    group: 'admin',
    icon: 'book',
  },
  {
    /**
     * An offering is a placement, not a subject. It has its own permission
     * because it is a different record with a different owner: the exam
     * cell and the HOD place subjects, while the catalogue itself is
     * maintained separately.
     */
    path: SCREENS.OFFERING_NEW,
    label: 'Add subject offering',
    permissions: ['subject_offerings:write'],
    group: 'admin',
    icon: 'book',
  },
  {
    path: SCREENS.ASSIGNMENTS,
    label: 'Assignments',
    permissions: ['teacher_allocations:read', 'class_teacher_assignments:read'],
    group: 'admin',
    icon: 'assignments',
  },
  {
    path: SCREENS.MEMBERS,
    label: 'Members',
    permissions: ['users:read'],
    group: 'admin',
    icon: 'users',
  },
  {
    path: SCREENS.MEMBER_NEW,
    label: 'Add member',
    permissions: ['users:write'],
    group: 'admin',
    icon: 'users',
  },
  {
    path: SCREENS.MEMBER_EDIT,
    label: 'Edit member',
    permissions: ['users:write'],
    group: 'admin',
    icon: 'users',
  },
  {
    path: SCREENS.ROLES,
    label: 'Roles',
    permissions: ['rbac:read'],
    group: 'admin',
    icon: 'shield',
  },
  {
    path: SCREENS.SCHEMES,
    label: 'Schemes',
    permissions: ['schemes:read'],
    group: 'admin',
    icon: 'file',
  },
  {
    path: SCREENS.SCHEME_NEW,
    label: 'Add scheme',
    permissions: ['schemes:write'],
    group: 'admin',
    icon: 'file',
  },
  {
    path: SCREENS.SCHEME_EDIT,
    label: 'Edit scheme',
    permissions: ['schemes:write'],
    group: 'admin',
    icon: 'file',
  },
  {
    /**
     * Reading a syllabus out of a PDF is a separate screen from the scheme
     * list. It belongs to the same permission, but it is named separately so
     * that a refusal names the screen the member actually asked for.
     */
    path: SCREENS.SCHEME_READ,
    label: 'Read a Syllabus',
    permissions: ['schemes:read'],
    group: 'admin',
    icon: 'file',
  },
  {
    /**
     * The academic structure — the screen the college navigates by.
     *
     * Branches, years, semesters, the subjects taught to each class, the
     * teachers, and how ready each class is.
     */
    path: SCREENS.ACADEMIC_STRUCTURE,
    label: 'Academic Structure',
    permissions: ['subject_offerings:read', 'subjects:read'],
    group: 'admin',
    icon: 'layers',
  },
  {
    /**
     * Publishing a class's result.
     *
     * The last step of the college's cycle: everything before it produces
     * a working sheet of marks, and this is the moment the result becomes
     * the answer the college gives.
     */
    path: SCREENS.PUBLICATIONS,
    label: 'Publish results',
    permissions: ['examinations:read', 'examinations:write'],
    group: 'admin',
    icon: 'file',
  },
  {
    path: SCREENS.BRANCHES,
    label: 'Branches',
    permissions: ['branches:read'],
    group: 'admin',
    icon: 'building',
  },
  {
    path: SCREENS.ACADEMIC_YEARS,
    label: 'Academic Years',
    permissions: ['academic_years:read'],
    group: 'admin',
    icon: 'calendar',
  },
  {
    path: SCREENS.AUDIT_LOG,
    label: 'Audit Log',
    permissions: ['audit:read'],
    group: 'admin',
    icon: 'history',
  },
  /**
   * The account screen.
   *
   * Its permission list is **empty**, and that is deliberate: every signed-in
   * member may see their own account and change their own details. An empty
   * list means "open to every authenticated member" — the same rule the
   * shared helper already applies.
   *
   * Naming it here rather than leaving it out matters. A screen the
   * catalogue does not name is a screen the guard cannot reason about; this
   * one is named *and* open, so the guard knows the difference between "no
   * rule" and "a rule that says yes to everyone".
   */
  {
    path: SCREENS.MY_ACCOUNT,
    label: 'My account',
    permissions: [],
    group: 'workspace',
  },
  {
    /**
     * The password-change screen.
     *
     * Open to everyone for the same reason as the account screen — and it
     * *must* be, because the shell sends every member whose password has
     * expired to this page. A guard that refused it would lock those members
     * out of the one screen that fixes the problem.
     */
    path: SCREENS.CHANGE_PASSWORD,
    label: 'Change password',
    permissions: [],
    group: 'workspace',
  },
] as const;

/**
 * The actions a member may take, and the permission each one needs.
 *
 * The frontend uses this to decide whether to render a button at all. The
 * backend uses the same names in its service-layer guards, so a button that
 * is hidden and the operation that is refused can never disagree.
 */
export const ACTIONS = {
  // Students
  CREATE_STUDENT: 'students:write',
  EDIT_STUDENT: 'students:write',
  DELETE_STUDENT: 'students:write',
  IMPORT_STUDENTS: 'students:write',
  PROVISION_STUDENT_LOGIN: 'students:write',
  /** Provision a whole class of student logins in one run. */
  BULK_PROVISION_STUDENT_LOGINS: 'students:bulk_provision',

  // Marks
  ENTER_MARKS: 'marks:enter_own_subject',
  /** The exam cell's broader right to write a mark for any offering in scope. */
  WRITE_MARKS: 'marks:write',
  /** The exam cell's deliberate, audited override of a teacher's subject. */
  CORRECT_MARKS: 'marks:write',

  // Subjects and offerings
  CREATE_SUBJECT: 'subjects:write',
  EDIT_SUBJECT: 'subjects:write',
  DELETE_SUBJECT: 'subjects:delete',
  CREATE_OFFERING: 'subject_offerings:write',
  EDIT_OFFERING: 'subject_offerings:write',
  DELETE_OFFERING: 'subject_offerings:write',

  // Schemes
  CREATE_SCHEME: 'schemes:write',
  EDIT_SCHEME: 'schemes:write',
  DELETE_SCHEME: 'schemes:write',

  // Teaching assignments
  ALLOCATE_SUBJECT: 'teacher_allocations:write',
  RELEASE_SUBJECT: 'teacher_allocations:write',
  ASSIGN_CLASS_TEACHER: 'class_teacher_assignments:write',
  RELEASE_CLASS_TEACHER: 'class_teacher_assignments:write',

  // Members
  CREATE_MEMBER: 'users:write',
  EDIT_MEMBER: 'users:write',
  REVOKE_MEMBER: 'users:write',
  ASSIGN_ROLE: 'rbac:write',

  // Uploads and reports
  UPLOAD_RESULTS: 'upload:create',
  /** Approve an extraction for the whole batch — the exam cell's right. */
  PROCESS_UPLOAD: 'upload:process',
  /** Write the extracted score for the subjects allocated to the member. */
  PROCESS_UPLOAD_OWN_SUBJECT: 'upload:process_own_subject',
  GENERATE_REPORT: 'reports:generate',
  DOWNLOAD_REPORT: 'reports:download',

  // Administration
  MANAGE_BRANCHES: 'branches:write',
  DELETE_BRANCH: 'branches:delete',
  MANAGE_SCHEMES: 'schemes:write',
  MANAGE_ACADEMIC_YEARS: 'academic_years:write',
  VIEW_AUDIT_LOG: 'audit:read',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

/**
 * Answers "may this member open this screen?".
 *
 * A member needs **at least one** of the screen's `permissions` (plus all of
 * its `requiresAll`, if any). An empty permission list means the screen is
 * open to every authenticated member.
 */
export function canAccessScreen(
  held: readonly string[],
  screen: ScreenCapability
): boolean {
  if (screen.requiresAll?.length) {
    for (const permission of screen.requiresAll) {
      if (!held.includes(permission)) return false;
    }
  }
  if (!screen.permissions.length) return true;
  return screen.permissions.some((permission) => held.includes(permission));
}

/**
 * Answers "may this member take this action?".
 *
 * The action names are the permission strings themselves, so a caller passes
 * the same value in both worlds without a translation table.
 */
export function canPerform(held: readonly string[], action: string): boolean {
  return held.includes(action);
}

/** The screens a member may open, in catalogue order. */
export function accessibleScreens(held: readonly string[]): ScreenCapability[] {
  return SCREEN_CAPABILITIES.filter((screen) => canAccessScreen(held, screen));
}

/**
 * The screens a member may *not* open.
 *
 * Used by the route guard to send the member to a page that explains why,
 * rather than silently redirecting them somewhere they did not ask for.
 */
export function inaccessibleScreens(held: readonly string[]): ScreenCapability[] {
  return SCREEN_CAPABILITIES.filter((screen) => !canAccessScreen(held, screen));
}
