import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { resolveAcademicYear } from '@/common/utils/academic-year';
import { ScopeService } from '@/common/services/scope.service';
import { DashboardScopeRepository } from './dashboard-scope.repository';
import type {
  DashboardMetric,
  DashboardResponse,
  DashboardScopeKind,
  DashboardSection,
  DashboardSectionItem,
  DashboardUpload,
  DashboardViewer,
} from './dashboard.types';

/** Caller-supplied filters. Every one of them narrows within the caller's scope. */
export interface DashboardScope {
  branchId?: string;
  schemeId?: string;
  semester?: number;
}

/**
 * Permission names the dashboard reasons about.
 *
 * These are the seeded permission names (`apps/backend/prisma/seed.ts`). They
 * are read from the caller's effective permission set, never from a role
 * name, so a member who holds two roles gets the union of both capabilities
 * (§3.1).
 */
const PERM = {
  STUDENTS_READ: 'students:read',
  MARKS_READ: 'marks:read',
  MARKS_WRITE: 'marks:write',
  MARKS_ENTER_OWN_SUBJECT: 'marks:enter_own_subject',
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_READ_OWN_DEPARTMENT: 'analytics:read_own_department',
  UPLOAD_CREATE: 'upload:create',
  TOPPERS_READ: 'toppers:read',
  /**
   * The governance permission. A member who can read the audit trail is
   * supervising the college rather than doing the work in it, which is what
   * §3.2 describes for the Super Admin.
   */
  AUDIT_READ: 'audit:read',
} as const;

/** A student's aggregate percentage is a pass at 40%. */
const PASS_PERCENTAGE = 40;

/** How many toppers to name per branch. */
const TOPPERS_PER_BRANCH = 3;

/** The row shape read from the `examinations` table. */
interface ExaminationRow {
  id: string;
  branchId: string;
  semester: number;
  status: string;
  resultPublishedAt: Date | null;
}

/**
 * The outcome of the result-publication query.
 *
 * `available` is false when the `examinations` table could not be read — the
 * table is a new addition and may not be migrated yet.
 */
interface PublicationResult {
  available: boolean;
  items: DashboardSectionItem[];
}

/**
 * The class scope of a teacher: the offerings they are allocated, the
 * students of the classes they teach, and the branches those classes are in.
 */
interface ClassScope {
  offeringIds: string[];
  studentIds: string[];
  branchIds: string[];
  /** The classes (branch + semester + scheme) the teacher is class teacher for. */
  classCount: number;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly scopeRepository: DashboardScopeRepository,
    private readonly scopeService: ScopeService
  ) {}

  /**
   * Builds the dashboard for the signed-in member.
   *
   * The response is assembled from the caller's *effective permissions*, not
   * from their role: the scope is decided first, and the metrics that follow
   * are the ones that scope makes meaningful. A member holding several roles
   * gets the union of what those roles allow.
   */
  async getDashboard(viewer: DashboardViewer, scope: DashboardScope): Promise<DashboardResponse> {
    const academicYear = await resolveAcademicYear(this.prisma);
    const degraded: string[] = [];

    if (!academicYear) {
      this.logger.warn('No academic year exists yet — the dashboard will report zeroes.');
    }

    const plan = this.planFor(viewer);

    if (plan.scope === 'own') {
      return this.buildOwnDashboard(viewer, academicYear, degraded);
    }

    return this.buildScopedDashboard(viewer, plan, scope, academicYear, degraded);
  }

  // ---------------------------------------------------------------------------
  // Scope planning
  // ---------------------------------------------------------------------------

  /**
   * Decides which scope the caller's data lives in.
   *
   * The scope is the *shape* of the dashboard — which metrics and sections
   * make sense — while the actual data is always filtered by the caller's
   * branch scope and, for a teacher, by their allocations.
   *
   * The rules, in order:
   *
   * 1. A member with a linked student record sees their *own* result. A
   *    student who also happens to hold staff permissions keeps the student
   *    view, because their own result is what they came for.
   * 2. A member who may enter marks only for their own allocations, and who
   *    holds no exam-cell write permission, sees the *class* view limited to
   *    those allocations. That is the teacher (§3.6): the subject teacher
   *    enters marks for the subjects the HOD allocated to them, and sees
   *    their students and their own pending list. A teacher with no
   *    allocation lands here too and sees an empty dashboard, which is the
   *    truth — they have nothing to look at.
   * 3. A member who can read their *own department* sees the *branch* view.
   *    This is the HOD's reach (§3.4): the role is always branch-scoped, and
   *    `analytics:read_own_department` is the permission that says so.
   * 4. A member who can read analytics across the whole college sees the
   *    *college* view. The Principal lands here; the Exam Cell Admin lands
   *    here too because the exam cell administers the whole exam, not one
   *    branch. Their data is still narrowed to their branch scope if they
   *    hold one.
   * 5. Anything else falls back to the college view with the read-only
   *    metrics only. This is the safe default: it never under-reports what a
   *    member is entitled to see.
   */
  private planFor(viewer: DashboardViewer): { scope: DashboardScopeKind } {
    if (viewer.studentId) return { scope: 'own' };

    const canReadOwnDepartment = viewer.permissions.includes(PERM.ANALYTICS_READ_OWN_DEPARTMENT);
    const canEnterOwnSubject = viewer.permissions.includes(PERM.MARKS_ENTER_OWN_SUBJECT);
    // The exam cell writes marks for *every* subject, so a member who holds
    // the full write permission is not allocation-bound.
    const canWriteAnyMark = viewer.permissions.includes(PERM.MARKS_WRITE);

    // A teacher: allocations only, no exam-cell write reach.
    if (canEnterOwnSubject && !canWriteAnyMark && !canReadOwnDepartment) {
      return { scope: 'class' };
    }

    // An HOD: their own department, never the whole college.
    if (canReadOwnDepartment) {
      return { scope: 'branch' };
    }

    // College-wide reach. The data is still filtered to the caller's branch
    // scope by `resolveScopeBranchIds` if they hold one.
    return { scope: 'college' };
  }

  // ---------------------------------------------------------------------------
  // Student ("own") dashboard
  // ---------------------------------------------------------------------------

  /**
   * The student's own result summary. Nothing about anyone else — §3.7.
   */
  private async buildOwnDashboard(
    viewer: DashboardViewer,
    academicYear: { id: string; year: string } | null,
    degraded: string[]
  ): Promise<DashboardResponse> {
    const studentId = viewer.studentId!;

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        rollNo: true,
        name: true,
        semester: true,
        currentYear: true,
        branch: { select: { id: true, code: true, name: true } },
        academicYearId: true,
      },
    });

    if (!student) {
      return this.emptyResponse(
        'own',
        'Your result',
        [],
        degraded,
        academicYear,
        this.roleLabel(viewer)
      );
    }

    const marks = await this.prisma.mark.findMany({
      where: {
        studentId,
        isAbsent: false,
        isWithheld: false,
        ...(academicYear ? { academicYearId: academicYear.id } : {}),
      },
      select: {
        marksObtained: true,
        maxMarks: true,
        subjectOffering: {
          select: {
            id: true,
            semester: true,
            subject: { select: { id: true, code: true, name: true, maxMarks: true } },
          },
        },
      },
    });

    // Aggregate per subject: a subject has several components (CA1, CA2, …).
    const perSubject = new Map<
      string,
      { code: string; name: string; obtained: number; max: number }
    >();
    for (const mark of marks) {
      if (!Number.isFinite(mark.maxMarks) || mark.maxMarks <= 0) continue;
      const offering = mark.subjectOffering;
      const cur = perSubject.get(offering.id) ?? {
        code: offering.subject.code,
        name: offering.subject.name,
        obtained: 0,
        max: 0,
      };
      cur.obtained += mark.marksObtained;
      cur.max += mark.maxMarks;
      perSubject.set(offering.id, cur);
    }

    let totalObtained = 0;
    let totalMax = 0;
    let passedSubjects = 0;
    const subjectItems: DashboardSectionItem[] = [];

    for (const subject of perSubject.values()) {
      const pct = subject.max > 0 ? (subject.obtained / subject.max) * 100 : 0;
      totalObtained += subject.obtained;
      totalMax += subject.max;
      if (pct >= PASS_PERCENTAGE) passedSubjects += 1;
      subjectItems.push({
        label: `${subject.code} — ${subject.name}`,
        value: Math.round(pct * 10) / 10,
        secondary: `${subject.obtained} / ${subject.max}`,
      });
    }

    subjectItems.sort((a, b) => b.value - a.value);

    const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    const gradedSubjects = perSubject.size;
    const allPassed = gradedSubjects > 0 && passedSubjects === gradedSubjects;

    const metrics: DashboardMetric[] = [
      {
        key: 'percentage',
        label: 'Overall percentage',
        value: Math.round(percentage * 10) / 10,
        hint: `${totalObtained} marks out of ${totalMax}`,
        trend: percentage >= PASS_PERCENTAGE ? 'up' : 'down',
      },
      {
        key: 'result',
        label: 'Result',
        value: gradedSubjects === 0 ? 'Not declared' : allPassed ? 'Pass' : 'Fail',
        hint:
          gradedSubjects === 0
            ? 'Your marks have not been entered yet'
            : `${passedSubjects} of ${gradedSubjects} subjects cleared`,
      },
      {
        key: 'subjects',
        label: 'Subjects graded',
        value: gradedSubjects,
        hint: `Semester ${student.semester} · Year ${student.currentYear}`,
      },
      {
        key: 'rollNo',
        label: 'Roll number',
        value: student.rollNo,
        hint: student.branch.name,
      },
    ];

    const sections: DashboardSection[] = [];
    if (subjectItems.length > 0) {
      sections.push({
        key: 'subject-performance',
        title: 'Subject-wise performance',
        kind: 'bar',
        items: subjectItems,
      });
    }

    return {
      scope: 'own',
      scopeLabel: `${student.branch.name} · Semester ${student.semester}`,
      roleLabel: this.roleLabel(viewer),
      academicYear,
      metrics,
      sections,
      kpis: {
        totalStudents: 1,
        passPercentage: allPassed ? 100 : percentage >= PASS_PERCENTAGE ? 100 : 0,
        totalSubjects: gradedSubjects,
        averagePercentage: Math.round(percentage * 10) / 10,
      },
      recentUploads: await this.recentUploads('own', viewer),
      degraded,
    };
  }

  // ---------------------------------------------------------------------------
  // College / Branch / Class dashboards
  // ---------------------------------------------------------------------------

  private async buildScopedDashboard(
    viewer: DashboardViewer,
    plan: { scope: DashboardScopeKind },
    query: DashboardScope,
    academicYear: { id: string; year: string } | null,
    degraded: string[]
  ): Promise<DashboardResponse> {
    const yearId = academicYear?.id;

    // In the class scope the caller's world is narrowed to the subjects they
    // are allocated and the classes they are class teacher for. This is
    // resolved first because it also determines which branches are in scope.
    const classScope =
      plan.scope === 'class' ? await this.resolveClassScope(viewer, yearId) : undefined;

    // The branches the figures cover. For the college scope that is every
    // branch; for the branch scope it is the caller's own branches.
    const scopeBranchIds = await this.resolveScopeBranchIds(viewer, plan.scope, query, classScope);

    const studentWhere = this.buildStudentWhere(yearId, scopeBranchIds, query);
    const offeringWhere = this.buildOfferingWhere(yearId, scopeBranchIds, query);

    // A teacher only sees the students of their own subjects and classes.
    const scopedStudentWhere = classScope
      ? { ...studentWhere, id: { in: classScope.studentIds } }
      : studentWhere;

    // A teacher only sees the offerings they are allocated.
    const scopedOfferingWhere = classScope
      ? { ...offeringWhere, id: { in: classScope.offeringIds } }
      : offeringWhere;

    const [
      totalStudents,
      studentsByBranch,
      studentsBySemester,
      totalOfferings,
      offeringsBySemester,
      marks,
    ] = await Promise.all([
      this.prisma.student.count({ where: scopedStudentWhere }),
      this.prisma.student.groupBy({
        by: ['branchId'],
        where: scopedStudentWhere,
        _count: { _all: true },
      }),
      this.prisma.student.groupBy({
        by: ['semester'],
        where: scopedStudentWhere,
        _count: { _all: true },
      }),
      this.prisma.subjectOffering.count({ where: scopedOfferingWhere }),
      this.prisma.subjectOffering.groupBy({
        by: ['semester'],
        where: scopedOfferingWhere,
        _count: { _all: true },
      }),
      this.prisma.mark.findMany({
        where: this.buildMarkWhere(yearId, scopedStudentWhere),
        select: {
          studentId: true,
          marksObtained: true,
          maxMarks: true,
          student: { select: { branchId: true } },
        },
      }),
    ]);

    // Pass percentage is computed per student, not per mark: a student has
    // many marks, and counting mark rows would report one "student" per
    // subject.
    const perStudent = new Map<string, { obtained: number; max: number }>();
    for (const mark of marks) {
      if (!Number.isFinite(mark.maxMarks) || mark.maxMarks <= 0) continue;
      const cur = perStudent.get(mark.studentId) ?? { obtained: 0, max: 0 };
      cur.obtained += mark.marksObtained;
      cur.max += mark.maxMarks;
      perStudent.set(mark.studentId, cur);
    }

    let passed = 0;
    let sumPct = 0;
    let graded = 0;
    for (const agg of perStudent.values()) {
      if (agg.max <= 0) continue;
      const pct = (agg.obtained / agg.max) * 100;
      sumPct += pct;
      graded += 1;
      if (pct >= PASS_PERCENTAGE) passed += 1;
    }
    const passPercentage = graded > 0 ? (passed / graded) * 100 : 0;
    const averagePercentage = graded > 0 ? sumPct / graded : 0;

    // Marks uploaded vs pending, at the level of a subject offering.
    const uploadStatus = await this.computeUploadStatus(scopedOfferingWhere, yearId);

    const branchNames = await this.branchNames(scopeBranchIds);
    const perBranch = await this.perBranchBreakdown(scopedStudentWhere, yearId);
    const toppers = await this.toppersPerBranch(scopedStudentWhere, yearId);

    const metrics = this.buildMetrics({
      plan,
      viewer,
      totalStudents,
      totalOfferings,
      passPercentage,
      averagePercentage,
      uploadStatus,
      classScope,
    });

    const sections = await this.buildSections({
      plan,
      viewer,
      studentsByBranch,
      studentsBySemester,
      offeringsBySemester,
      branchNames,
      perBranch,
      toppers,
      uploadStatus,
      yearId,
      scopeBranchIds,
      degraded,
    });

    const scopeLabel = await this.buildScopeLabel(plan.scope, scopeBranchIds);

    return {
      scope: plan.scope,
      scopeLabel,
      roleLabel: this.roleLabel(viewer),
      academicYear,
      metrics,
      sections,
      kpis: {
        totalStudents,
        passPercentage: round1(passPercentage),
        totalSubjects: totalOfferings,
        averagePercentage: round1(averagePercentage),
      },
      recentUploads: await this.recentUploads(plan.scope, viewer),
      degraded,
    };
  }

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  /**
   * The branches the figures cover.
   *
   * A caller's branch scope is authoritative: the `branchId` query parameter
   * can only narrow it further, never widen it. Without a branch scope every
   * branch is in play.
   *
   * The branch scope is resolved by `ScopeService`, which is the same rule
   * every other read in the application follows. It rejects a request for a
   * branch the caller does not hold rather than quietly redirecting them.
   */
  private async resolveScopeBranchIds(
    viewer: DashboardViewer,
    scope: DashboardScopeKind,
    query: DashboardScope,
    classScope: ClassScope | undefined
  ): Promise<string[] | undefined> {
    if (scope === 'class') {
      // A teacher's world is the branches their allocations and class-teacher
      // assignments cover. The `branchId` parameter cannot widen that.
      const allocated = classScope?.branchIds ?? [];
      if (allocated.length === 0) return undefined;
      if (query.branchId) {
        return allocated.includes(query.branchId) ? [query.branchId] : allocated;
      }
      return allocated;
    }

    // Both the college and the branch scope are filtered by the caller's
    // branch scope. `ScopeService` returns `undefined` for a college-scoped
    // member (no filter at all) and the branch set otherwise, and it rejects
    // a request for a branch the caller does not hold.
    return this.scopeService.resolveBranchFilter(viewer.userId, query.branchId);
  }

  /**
   * The class scope of a teacher: the subject offerings they are allocated,
   * the students of the classes they are class teacher for, and the branches
   * those classes live in.
   *
   * The students of an allocated subject are the students of the class the
   * offering belongs to (branch + semester + scheme), so a teacher sees the
   * students they actually teach.
   */
  private async resolveClassScope(
    viewer: DashboardViewer,
    yearId: string | undefined
  ): Promise<ClassScope> {
    // Allocations are recorded per academic year: the subject a teacher taught
    // last year is not theirs to report on this year.
    const yearFilter = yearId ? { academicYearId: yearId } : {};
    const [allocations, classTeacher] = await Promise.all([
      this.prisma.teacherSubject.findMany({
        where: { teacherId: viewer.userId, ...yearFilter },
        select: {
          subjectOfferingId: true,
          subjectOffering: {
            select: { branchId: true, semester: true, schemeId: true },
          },
        },
      }),
      this.prisma.classTeacherAssignment.findMany({
        where: { teacherId: viewer.userId, ...yearFilter },
        select: { branchId: true, semester: true, schemeId: true },
      }),
    ]);

    const offeringIds = [...new Set(allocations.map((a) => a.subjectOfferingId))];

    // The classes the teacher is class teacher for — exactly one per class
    // (§3.4), so this is the count of their assignments.
    const classTeacherKeys = new Set(
      classTeacher.map((a) => classKey(a.branchId, a.semester, a.schemeId))
    );

    // The classes the teacher touches: one per allocation and one per
    // class-teacher assignment.
    const classes = new Map<string, { branchId: string; semester: number; schemeId: string }>();
    for (const allocation of allocations) {
      const offering = allocation.subjectOffering;
      classes.set(classKey(offering.branchId, offering.semester, offering.schemeId), offering);
    }
    for (const assignment of classTeacher) {
      classes.set(
        classKey(assignment.branchId, assignment.semester, assignment.schemeId),
        assignment
      );
    }

    const branchIds = [...new Set([...classes.values()].map((c) => c.branchId))];

    const studentIds: string[] = [];
    if (classes.size > 0) {
      const students = await this.prisma.student.findMany({
        where: {
          isActive: true,
          OR: [...classes.values()].map((c) => ({
            branchId: c.branchId,
            semester: c.semester,
            schemeId: c.schemeId,
          })),
        },
        select: { id: true },
      });
      studentIds.push(...students.map((s) => s.id));
    }

    return { offeringIds, studentIds, branchIds, classCount: classTeacherKeys.size };
  }

  private buildStudentWhere(
    yearId: string | undefined,
    branchIds: string[] | undefined,
    query: DashboardScope
  ): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = { isActive: true };
    if (yearId) where.academicYearId = yearId;
    if (branchIds && branchIds.length > 0) where.branchId = { in: branchIds };
    if (query.schemeId) where.schemeId = query.schemeId;
    if (query.semester !== undefined && Number.isFinite(query.semester)) {
      where.semester = query.semester;
    }
    return where;
  }

  private buildOfferingWhere(
    yearId: string | undefined,
    branchIds: string[] | undefined,
    query: DashboardScope
  ): Prisma.SubjectOfferingWhereInput {
    const where: Prisma.SubjectOfferingWhereInput = { isActive: true };
    // An offering with no academic year is a scheme-wide offering; it still
    // counts towards the subject catalogue.
    if (yearId) {
      where.OR = [{ academicYearId: yearId }, { academicYearId: null }];
    }
    if (branchIds && branchIds.length > 0) where.branchId = { in: branchIds };
    if (query.schemeId) where.schemeId = query.schemeId;
    if (query.semester !== undefined && Number.isFinite(query.semester)) {
      where.semester = query.semester;
    }
    return where;
  }

  private buildMarkWhere(
    yearId: string | undefined,
    studentWhere: Prisma.StudentWhereInput
  ): Prisma.MarkWhereInput {
    const where: Prisma.MarkWhereInput = {
      isAbsent: false,
      isWithheld: false,
      student: studentWhere,
    };
    if (yearId) where.academicYearId = yearId;
    return where;
  }

  // ---------------------------------------------------------------------------
  // Upload status (marks uploaded vs pending)
  // ---------------------------------------------------------------------------

  /**
   * How many subject-offerings have marks entered for the year, and how many
   * have none.
   *
   * An offering counts as "uploaded" when it has at least one mark row for the
   * academic year. For a teacher the count is limited to the offerings they
   * are allocated to, because a teacher's pending list is their own work
   * queue.
   */
  private async computeUploadStatus(
    offeringWhere: Prisma.SubjectOfferingWhereInput,
    yearId: string | undefined
  ): Promise<{ uploaded: number; pending: number; pendingList: DashboardSectionItem[] }> {
    const offerings = await this.prisma.subjectOffering.findMany({
      where: offeringWhere,
      select: {
        id: true,
        semester: true,
        branchId: true,
        subject: { select: { code: true, name: true } },
      },
    });

    if (offerings.length === 0) {
      return { uploaded: 0, pending: 0, pendingList: [] };
    }

    // The mark rows are read for these offerings only — grouping marks across
    // the whole college would pull in every mark row just to decide which
    // offerings are empty.
    const offeringIds = offerings.map((o) => o.id);
    const markedOfferings = await this.prisma.mark.groupBy({
      by: ['subjectOfferingId'],
      where: {
        subjectOfferingId: { in: offeringIds },
        ...(yearId ? { academicYearId: yearId } : {}),
      },
      _count: { _all: true },
    });

    const markedIds = new Set(markedOfferings.map((m) => m.subjectOfferingId));
    const pending = offerings.filter((o) => !markedIds.has(o.id));
    const branchNames = await this.branchNames([...new Set(offerings.map((o) => o.branchId))]);

    return {
      uploaded: offerings.length - pending.length,
      pending: pending.length,
      pendingList: pending.slice(0, 12).map((o) => ({
        label: `${o.subject.code} — ${o.subject.name}`,
        value: 1,
        secondary: `Semester ${o.semester}${
          branchNames.has(o.branchId) ? ` · ${branchNames.get(o.branchId)}` : ''
        }`,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Breakdowns
  // ---------------------------------------------------------------------------

  /**
   * Per-branch pass percentage, used for the "pass percentage per branch"
   * section.
   */
  private async perBranchBreakdown(
    studentWhere: Prisma.StudentWhereInput,
    yearId: string | undefined
  ): Promise<Map<string, { students: number; passed: number; graded: number }>> {
    const marks = await this.prisma.mark.findMany({
      where: this.buildMarkWhere(yearId, studentWhere),
      select: {
        studentId: true,
        marksObtained: true,
        maxMarks: true,
        student: { select: { branchId: true } },
      },
    });

    const perStudent = new Map<string, { branchId: string; obtained: number; max: number }>();
    for (const mark of marks) {
      if (!Number.isFinite(mark.maxMarks) || mark.maxMarks <= 0) continue;
      const cur = perStudent.get(mark.studentId) ?? {
        branchId: mark.student.branchId,
        obtained: 0,
        max: 0,
      };
      cur.obtained += mark.marksObtained;
      cur.max += mark.maxMarks;
      perStudent.set(mark.studentId, cur);
    }

    const result = new Map<string, { students: number; passed: number; graded: number }>();
    for (const agg of perStudent.values()) {
      const entry = result.get(agg.branchId) ?? { students: 0, passed: 0, graded: 0 };
      entry.students += 1;
      entry.graded += 1;
      if (agg.max > 0 && (agg.obtained / agg.max) * 100 >= PASS_PERCENTAGE) entry.passed += 1;
      result.set(agg.branchId, entry);
    }

    return result;
  }

  /**
   * The top student of each branch, by aggregate percentage.
   */
  private async toppersPerBranch(
    studentWhere: Prisma.StudentWhereInput,
    yearId: string | undefined
  ): Promise<DashboardSectionItem[]> {
    const marks = await this.prisma.mark.findMany({
      where: this.buildMarkWhere(yearId, studentWhere),
      select: {
        studentId: true,
        marksObtained: true,
        maxMarks: true,
        student: { select: { branchId: true, rollNo: true, name: true } },
      },
    });

    const perStudent = new Map<
      string,
      { branchId: string; rollNo: string; name: string; obtained: number; max: number }
    >();
    for (const mark of marks) {
      if (!Number.isFinite(mark.maxMarks) || mark.maxMarks <= 0) continue;
      const cur = perStudent.get(mark.studentId) ?? {
        branchId: mark.student.branchId,
        rollNo: mark.student.rollNo,
        name: mark.student.name,
        obtained: 0,
        max: 0,
      };
      cur.obtained += mark.marksObtained;
      cur.max += mark.maxMarks;
      perStudent.set(mark.studentId, cur);
    }

    const bestPerBranch = new Map<string, { name: string; rollNo: string; pct: number }>();
    for (const agg of perStudent.values()) {
      if (agg.max <= 0) continue;
      const pct = (agg.obtained / agg.max) * 100;
      const current = bestPerBranch.get(agg.branchId);
      if (!current || pct > current.pct) {
        bestPerBranch.set(agg.branchId, { name: agg.name, rollNo: agg.rollNo, pct });
      }
    }

    const branchNames = await this.branchNames([...bestPerBranch.keys()]);
    const items = [...bestPerBranch.entries()].map(([branchId, topper]) => ({
      label: topper.name,
      value: Math.round(topper.pct * 10) / 10,
      secondary: `${branchNames.get(branchId) ?? 'Branch'} · ${topper.rollNo}`,
    }));

    items.sort((a, b) => b.value - a.value);
    return items.slice(0, TOPPERS_PER_BRANCH);
  }

  /**
   * The average student percentage for each academic year, oldest first.
   *
   * This is the trend line: it says whether the college is improving or
   * slipping, which is what a Principal reads the dashboard for (§3.5).
   */
  private async performanceTrends(
    branchIds: string[] | undefined
  ): Promise<DashboardSectionItem[]> {
    const years = await this.prisma.academicYear.findMany({
      orderBy: { startDate: 'asc' },
      select: { id: true, year: true },
    });

    if (years.length === 0) return [];

    const items: DashboardSectionItem[] = [];

    for (const year of years) {
      const marks = await this.prisma.mark.findMany({
        where: this.buildMarkWhere(year.id, this.buildStudentWhere(year.id, branchIds, {})),
        select: { studentId: true, marksObtained: true, maxMarks: true },
      });

      // Aggregate per student first: a student has many mark rows (one per
      // subject component), so averaging the rows would weight a student with
      // more components more heavily and report the wrong trend.
      const perStudent = new Map<string, { obtained: number; max: number }>();
      for (const mark of marks) {
        if (!Number.isFinite(mark.maxMarks) || mark.maxMarks <= 0) continue;
        const cur = perStudent.get(mark.studentId) ?? { obtained: 0, max: 0 };
        cur.obtained += mark.marksObtained;
        cur.max += mark.maxMarks;
        perStudent.set(mark.studentId, cur);
      }

      let sum = 0;
      let graded = 0;
      for (const agg of perStudent.values()) {
        if (agg.max <= 0) continue;
        sum += (agg.obtained / agg.max) * 100;
        graded += 1;
      }

      items.push({
        label: year.year,
        value: graded > 0 ? round1(sum / graded) : 0,
        secondary: graded > 0 ? `${graded} students graded` : 'No marks entered',
      });
    }

    return items;
  }

  /**
   * Branches whose academic data is incomplete.
   *
   * A branch is flagged when it has students but no subject offerings, or
   * subject offerings but no students, or students but no marks at all. Each
   * of those means the branch cannot produce a result at all.
   */
  private async branchesWithMissingData(
    branchIds: string[] | undefined,
    yearId: string | undefined
  ): Promise<DashboardSectionItem[]> {
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true, ...(branchIds ? { id: { in: branchIds } } : {}) },
      select: { id: true, code: true, name: true },
    });

    if (branches.length === 0) return [];

    const ids = branches.map((b) => b.id);
    const studentWhere = this.buildStudentWhere(yearId, ids, {});
    const offeringWhere = this.buildOfferingWhere(yearId, ids, {});

    const [studentCounts, offeringCounts, markedStudents] = await Promise.all([
      this.prisma.student.groupBy({
        by: ['branchId'],
        where: studentWhere,
        _count: { _all: true },
      }),
      this.prisma.subjectOffering.groupBy({
        by: ['branchId'],
        where: offeringWhere,
        _count: { _all: true },
      }),
      // Prisma 5 cannot group by a relation, so the branch is resolved from
      // the student rows the marks belong to.
      this.prisma.student.findMany({
        where: studentWhere,
        select: { id: true, branchId: true, _count: { select: { marks: true } } },
      }),
    ]);

    const students = new Map(studentCounts.map((r) => [r.branchId, r._count._all]));
    const offerings = new Map(offeringCounts.map((r) => [r.branchId, r._count._all]));

    const marks = new Map<string, number>();
    for (const student of markedStudents) {
      if (student._count.marks === 0) continue;
      marks.set(student.branchId, (marks.get(student.branchId) ?? 0) + student._count.marks);
    }

    const items: DashboardSectionItem[] = [];
    for (const branch of branches) {
      const studentCount = students.get(branch.id) ?? 0;
      const offeringCount = offerings.get(branch.id) ?? 0;
      const markCount = marks.get(branch.id) ?? 0;

      const issues: string[] = [];
      if (studentCount > 0 && offeringCount === 0) issues.push('no subjects');
      if (offeringCount > 0 && studentCount === 0) issues.push('no students');
      if (studentCount > 0 && offeringCount > 0 && markCount === 0) issues.push('no marks entered');

      if (issues.length > 0) {
        items.push({
          label: `${branch.code} — ${branch.name}`,
          value: issues.length,
          secondary: issues.join(', '),
        });
      }
    }

    return items;
  }

  /**
   * Result publication status per semester.
   *
   * The `examinations` table is a new addition and may not be migrated yet, so
   * the whole query is wrapped in a guard. If the table is missing the
   * dashboard still renders; the omission is reported through the `degraded`
   * list so the UI can say so instead of showing a misleading zero.
   */
  private async resultPublicationStatus(
    yearId: string | undefined,
    branchIds: string[] | undefined
  ): Promise<PublicationResult> {
    if (!yearId) return { available: true, items: [] };

    let examinations: ExaminationRow[];
    try {
      examinations = await this.prisma.examination.findMany({
        where: {
          academicYearId: yearId,
          ...(branchIds && branchIds.length > 0 ? { branchId: { in: branchIds } } : {}),
        },
        select: {
          id: true,
          branchId: true,
          semester: true,
          status: true,
          resultPublishedAt: true,
        },
      });
    } catch (error) {
      // The `examinations` table is new. Until the migration lands this query
      // fails; the dashboard must still work.
      this.logger.warn(
        `Result publication status unavailable: ${(error as Error).message}. ` +
          'The examinations table is probably not migrated yet.'
      );
      return { available: false, items: [] };
    }

    if (examinations.length === 0) return { available: true, items: [] };

    // One row per semester, aggregating the branches that ran it.
    const perSemester = new Map<number, { published: number; total: number }>();
    for (const exam of examinations) {
      const entry = perSemester.get(exam.semester) ?? { published: 0, total: 0 };
      entry.total += 1;
      if (exam.status === 'PUBLISHED' || exam.resultPublishedAt !== null) entry.published += 1;
      perSemester.set(exam.semester, entry);
    }

    return {
      available: true,
      items: [...perSemester.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([semester, entry]) => ({
          label: `Semester ${semester}`,
          value: entry.published,
          secondary: `${entry.published} of ${entry.total} published`,
        })),
    };
  }

  // ---------------------------------------------------------------------------
  // Metric and section assembly
  // ---------------------------------------------------------------------------

  /**
   * Whether the caller should see the marks-upload pipeline.
   *
   * Two groups qualify:
   *
   * - the people who can *act* on it — the exam cell (which enters marks for
   *   every subject) and a teacher (who enters them for their own
   *   allocations);
   * - the people who *supervise* it — a member who can read the audit trail
   *   is running the college rather than working in it, and §3.2 makes the
   *   upload pipeline one of the Super Admin's headline metrics.
   *
   * A Principal is excluded on purpose: they hold no write permission, so
   * "marks pending" would be a number they could do nothing about (§3.5).
   */
  private canSeeUploadPipeline(viewer: DashboardViewer): boolean {
    return (
      viewer.permissions.includes(PERM.MARKS_WRITE) ||
      viewer.permissions.includes(PERM.MARKS_ENTER_OWN_SUBJECT) ||
      viewer.permissions.includes(PERM.UPLOAD_CREATE) ||
      viewer.permissions.includes(PERM.AUDIT_READ)
    );
  }

  private buildMetrics(input: {
    plan: { scope: DashboardScopeKind };
    viewer: DashboardViewer;
    totalStudents: number;
    totalOfferings: number;
    passPercentage: number;
    averagePercentage: number;
    uploadStatus: { uploaded: number; pending: number };
    classScope: ClassScope | undefined;
  }): DashboardMetric[] {
    const { plan, viewer, totalStudents, totalOfferings, passPercentage, averagePercentage } =
      input;
    const metrics: DashboardMetric[] = [];

    // In the class scope the student count already reflects the teacher's own
    // students, so the same card works with a different label.
    if (plan.scope === 'class') {
      metrics.push({
        key: 'total-students',
        label: 'Students in your subjects',
        value: totalStudents,
        hint: 'Across your allocated subjects and classes',
      });
      metrics.push({
        key: 'classes',
        label: 'Your classes',
        value: input.classScope?.classCount ?? 0,
        hint: 'Classes where you are the class teacher',
      });
    } else {
      metrics.push({
        key: 'total-students',
        label: 'Total students',
        value: totalStudents,
        hint: 'Active in the current academic year',
      });
    }

    if (viewer.permissions.includes(PERM.STUDENTS_READ)) {
      metrics.push({
        key: 'total-subjects',
        label: 'Subject offerings',
        value: totalOfferings,
        hint: 'Active in the current academic year',
      });
    }

    if (viewer.permissions.includes(PERM.MARKS_READ)) {
      metrics.push({
        key: 'pass-percentage',
        label: 'Pass percentage',
        value: round1(passPercentage),
        hint: 'Students clearing 40% overall',
        trend: passPercentage >= PASS_PERCENTAGE ? 'up' : 'down',
      });
      metrics.push({
        key: 'average-percentage',
        label: 'Average percentage',
        value: round1(averagePercentage),
        hint: 'Mean across all students with marks',
      });
    }

    if (this.canSeeUploadPipeline(viewer)) {
      metrics.push({
        key: 'marks-uploaded',
        label: 'Marks uploaded',
        value: input.uploadStatus.uploaded,
        hint: 'Subject offerings with marks entered',
      });
      metrics.push({
        key: 'marks-pending',
        label: 'Marks pending',
        value: input.uploadStatus.pending,
        hint: 'Subject offerings still awaiting marks',
        trend: input.uploadStatus.pending > 0 ? 'down' : 'flat',
      });
    }

    return metrics;
  }

  private async buildSections(input: {
    plan: { scope: DashboardScopeKind };
    viewer: DashboardViewer;
    studentsByBranch: Array<{ branchId: string; _count: { _all: number } }>;
    studentsBySemester: Array<{ semester: number; _count: { _all: number } }>;
    offeringsBySemester: Array<{ semester: number; _count: { _all: number } }>;
    branchNames: Map<string, string>;
    perBranch: Map<string, { students: number; passed: number; graded: number }>;
    toppers: DashboardSectionItem[];
    uploadStatus: { uploaded: number; pending: number; pendingList: DashboardSectionItem[] };
    yearId: string | undefined;
    scopeBranchIds: string[] | undefined;
    degraded: string[];
  }): Promise<DashboardSection[]> {
    const { plan, viewer } = input;
    const sections: DashboardSection[] = [];

    const canReadAnalytics = viewer.permissions.includes(PERM.ANALYTICS_READ);
    const canReadOwnDepartment = viewer.permissions.includes(PERM.ANALYTICS_READ_OWN_DEPARTMENT);

    // Students per branch — the college-wide breakdown.
    if (plan.scope === 'college') {
      const items = input.studentsByBranch
        .map((row) => ({
          label: input.branchNames.get(row.branchId) ?? row.branchId,
          value: row._count._all,
        }))
        .sort((a, b) => b.value - a.value);

      if (items.length > 0) {
        sections.push({
          key: 'students-per-branch',
          title: 'Students per branch',
          kind: 'bar',
          items,
        });
      }
    }

    // Students per semester — every scope sees this; it is the shape of the
    // college that the HOD and the teacher both need.
    const semesterItems = input.studentsBySemester
      .map((row) => ({
        label: `Semester ${row.semester}`,
        value: row._count._all,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (semesterItems.length > 0) {
      sections.push({
        key: 'students-per-semester',
        title: 'Students per semester',
        kind: 'bar',
        items: semesterItems,
      });
    }

    // Subjects per semester.
    if (viewer.permissions.includes(PERM.STUDENTS_READ) || canReadAnalytics) {
      const offeringItems = input.offeringsBySemester
        .map((row) => ({
          label: `Semester ${row.semester}`,
          value: row._count._all,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      if (offeringItems.length > 0) {
        sections.push({
          key: 'subjects-per-semester',
          title: 'Subject offerings per semester',
          kind: 'bar',
          items: offeringItems,
        });
      }
    }

    // Pass rate per branch.
    if (canReadAnalytics || canReadOwnDepartment) {
      const passItems = [...input.perBranch.entries()]
        .map(([branchId, stats]) => ({
          label: input.branchNames.get(branchId) ?? branchId,
          value: stats.graded > 0 ? round1((stats.passed / stats.graded) * 100) : 0,
          secondary: `${stats.passed} of ${stats.students} passed`,
        }))
        .sort((a, b) => b.value - a.value);

      if (passItems.length > 0) {
        sections.push({
          key: 'pass-percentage-per-branch',
          title: 'Pass percentage per branch',
          kind: 'bar',
          items: passItems,
        });
      }
    }

    // Performance trend across academic years — the Principal's headline
    // read: progress and status, nothing operational.
    if (canReadAnalytics || canReadOwnDepartment) {
      const trends = await this.performanceTrends(input.scopeBranchIds);
      if (trends.length > 1) {
        sections.push({
          key: 'performance-trend',
          title: 'Average performance by academic year',
          kind: 'bar',
          items: trends,
        });
      }
    }

    // Toppers per branch.
    if (viewer.permissions.includes(PERM.TOPPERS_READ) && input.toppers.length > 0) {
      sections.push({
        key: 'toppers-per-branch',
        title: 'Toppers per branch',
        kind: 'list',
        items: input.toppers,
      });
    }

    // Departments with missing data — a governance concern, so it belongs to
    // the college-wide view.
    if (plan.scope === 'college' && canReadAnalytics) {
      const missing = await this.branchesWithMissingData(input.scopeBranchIds, input.yearId);
      if (missing.length > 0) {
        sections.push({
          key: 'branches-with-missing-data',
          title: 'Branches with missing data',
          kind: 'list',
          items: missing,
        });
      }
    }

    // Pending marks — the operational to-do list. Only a member who can act on
    // it, or who supervises it, gets the list of what is still outstanding.
    if (this.canSeeUploadPipeline(viewer) && input.uploadStatus.pendingList.length > 0) {
      sections.push({
        key: 'pending-marks',
        title: 'Subject offerings awaiting marks',
        kind: 'list',
        items: input.uploadStatus.pendingList,
      });
    }

    // Result publication status per semester.
    if (canReadAnalytics || canReadOwnDepartment) {
      const publications = await this.resultPublicationStatus(input.yearId, input.scopeBranchIds);
      if (!publications.available) {
        input.degraded.push('result-publication-status');
      } else if (publications.items.length > 0) {
        sections.push({
          key: 'result-publication',
          title: 'Result publication status per semester',
          kind: 'donut',
          items: publications.items,
        });
      }
    }

    return sections;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * The branches that appear in the figures, resolved to their display names.
   *
   * `undefined` means "every branch" — the college scope — so the map is
   * built from all active branches in that case.
   */
  private async branchNames(branchIds: string[] | undefined): Promise<Map<string, string>> {
    const map = new Map<string, string>();

    const branches = await this.prisma.branch.findMany({
      where: {
        isActive: true,
        ...(branchIds && branchIds.length > 0 ? { id: { in: branchIds } } : {}),
      },
      select: { id: true, code: true, name: true },
    });

    for (const branch of branches) {
      map.set(branch.id, branch.code || branch.name);
    }

    return map;
  }

  /**
   * A human-readable description of the scope the figures cover.
   */
  private async buildScopeLabel(
    scope: DashboardScopeKind,
    branchIds: string[] | undefined
  ): Promise<string> {
    // No branch filter means the figures cover the whole college.
    if (!branchIds || branchIds.length === 0) {
      return scope === 'class' ? 'Your subjects' : 'Whole college';
    }

    const labels = await this.scopeRepository.branchLabels(branchIds);
    if (labels.length === 0) return scope === 'class' ? 'Your subjects' : 'Your branch';
    if (labels.length === 1) return labels[0];
    return `${labels.length} branches`;
  }

  /**
   * The caller's roles, comma-joined. Empty when the member holds no role.
   */
  private roleLabel(viewer: DashboardViewer): string {
    if (viewer.roles.length === 0) return 'No role';
    return viewer.roles.join(', ');
  }

  /**
   * The five most recent upload jobs, newest first.
   *
   * Only the college scope sees the whole upload feed. The branch and class
   * scopes see the jobs raised by the member themselves — an HOD has no
   * business reading another branch's upload history, and a student sees
   * none at all.
   */
  private async recentUploads(
    scope: DashboardScopeKind,
    viewer: DashboardViewer
  ): Promise<DashboardUpload[]> {
    if (scope === 'own') return [];

    const where: Prisma.UploadJobWhereInput =
      scope === 'college' ? {} : { uploadedBy: viewer.userId };

    const rows = await this.prisma.uploadJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, fileName: true, status: true, createdAt: true },
    });

    return rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** An empty response, used when there is nothing to show at all. */
  private emptyResponse(
    scope: DashboardScopeKind,
    scopeLabel: string,
    metrics: DashboardMetric[],
    degraded: string[],
    academicYear: { id: string; year: string } | null,
    roleLabel: string
  ): DashboardResponse {
    return {
      scope,
      scopeLabel,
      roleLabel,
      academicYear,
      metrics,
      sections: [],
      kpis: {
        totalStudents: 0,
        passPercentage: 0,
        totalSubjects: 0,
        averagePercentage: 0,
      },
      recentUploads: [],
      degraded,
    };
  }
}

/** Rounds to one decimal place. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The identity of a class: branch + semester + scheme (§2 — "class" is a
 * semester under a scheme in a branch).
 */
function classKey(branchId: string, semester: number, schemeId: string): string {
  return `${branchId}:${semester}:${schemeId}`;
}
