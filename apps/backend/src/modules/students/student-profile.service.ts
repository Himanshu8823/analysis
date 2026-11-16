import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Mark, Prisma } from '@prisma/client';
import { AuthorisationService } from '@/common/services/authorisation.service';
import { MarksScopeService } from '../marks/marks-scope.service';
import { yearForSemester } from '@/common/utils/academic';
import type {
  StudentAcademicSnapshotView,
  StudentActivityView,
  StudentDocumentView,
  StudentEnrolledSubjectView,
  StudentGuardianView,
  StudentGuardiansView,
  StudentIdentityView,
  StudentMarkComponentView,
  StudentMarksHistoryGroup,
  StudentProfileView,
  StudentResultHistoryEntryView,
  StudentSensitiveIdentityView,
  StudentSubjectMarksView,
} from './dto/student-profile.dto';
import { gradeForPercentage } from './dto/student-profile.dto';

/**
 * The permissions that decide what a caller may read.
 *
 * They are named here rather than imported from the shared catalogue
 * because the backend may not import a *runtime* value from a workspace
 * package without moving the build output (see the note at the top of
 * `common/constants/roles.ts`). The strings themselves are the same ones
 * the catalogue and the seed use, and `student-profile.permissions.spec.ts`
 * asserts that they agree.
 */
export const STUDENT_PROFILE_PERMISSIONS = {
  /** May read the roster — the general student record. */
  READ: 'students:read',
  /** May read their own record. */
  READ_OWN: 'students:read_own',
  /** May read the sensitive identity block — the national id, the blood group. */
  READ_SENSITIVE: 'students:read_sensitive',
  /** May read the guardian block — the name, phone, email and occupation. */
  READ_GUARDIAN: 'students:read_guardian',
  /** May edit the record. */
  WRITE: 'students:write',
  /** May provision logins in bulk. */
  BULK_PROVISION: 'students:bulk_provision',
  /** May read the marks of the whole class — the exam cell's reach. */
  MARKS_READ: 'marks:read',
  /**
   * May enter a mark for the subjects the member is allocated to.
   *
   * Its presence is what identifies a **teacher** — the only role whose
   * mark rights are bounded by their allocations.
   */
  MARKS_ENTER_OWN_SUBJECT: 'marks:enter_own_subject',
  /** May write a mark for any offering in scope — the exam cell's reach. */
  MARKS_WRITE: 'marks:write',
  /** May read the whole college's analytics — the Principal's reach. */
  ANALYTICS_READ: 'analytics:read',
  /** May read their own department's analytics — the HOD's reach. */
  ANALYTICS_READ_OWN_DEPARTMENT: 'analytics:read_own_department',
  /** May generate reports. */
  REPORTS_GENERATE: 'reports:generate',
  /** May download reports. */
  REPORTS_DOWNLOAD: 'reports:download',
  /** May read the audit trail. */
  AUDIT_READ: 'audit:read',
  /** May read their own marks. */
  MARKS_READ_OWN: 'marks:read_own',
} as const;

/**
 * The profile service.
 *
 * ## What this service is for
 *
 * The profile screen is a *view*, and the view depends on who is asking.
 * A teacher sees the students they teach and the marks of their own
 * subjects; a Principal sees the academic picture without the sensitive
 * identity data; a student sees their own record and nothing else.
 *
 * ## How the gating works
 *
 * The gating is done by **omission**, not by masking. A caller who may not
 * read a field never receives the key at all: the response object simply
 * does not have `sensitive` on it. This matters because a frontend that
 * forgets to hide a column cannot leak what the server never sent — and a
 * field that arrived as `null` would have to be *actively* hidden, which is
 * one forgotten `className` away from being on screen.
 *
 * The alternative — sending every field and hiding them in the client —
 * puts the security boundary in the client, which is not a boundary at all.
 *
 * ## The rules, in the order they are applied
 *
 *  1. **Who is the caller?** A student account may only read their own
 *     record; every other caller is filtered by branch scope.
 *  2. **Which marks?** A caller with the whole-college reach sees every
 *     mark. A teacher sees only the marks of the subjects they were
 *     allocated, and the semesters they were allocated in — the rest is
 *     absent, not blank.
 *  3. **Which sensitive fields?** The national id and the blood group need
 *     `students:read_sensitive`. The guardian block needs
 *     `students:read_guardian`.
 */
@Injectable()
export class StudentProfileService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorisation: AuthorisationService,
    private readonly marksScope: MarksScopeService
  ) {}

  /**
   * Builds the whole profile for one student, as seen by one caller.
   *
   * @param studentId The student whose profile is being built.
   * @param callerId The member asking for it.
   */
  async buildProfile(studentId: string, callerId: string): Promise<StudentProfileView> {
    const permissions = await this.authorisation.permissionsOf(callerId);

    /**
     * A student account may read exactly one student record: their own.
     *
     * This is checked before anything else, because it decides whether the
     * caller may read the record *at all*. The record is resolved from the
     * session, never from the path — so there is no id the client could
     * tamper with to reach somebody else's profile.
     */
    const isOwnOnlyReader =
      permissions.includes(STUDENT_PROFILE_PERMISSIONS.READ_OWN) &&
      !permissions.includes(STUDENT_PROFILE_PERMISSIONS.READ);

    if (isOwnOnlyReader) {
      const own = await this.prisma.student.findFirst({
        where: { userId: callerId },
        select: { id: true },
      });

      if (!own) {
        throw new NotFoundException(
          'No student record is linked to your account. Please contact the examination cell.'
        );
      }
      if (own.id !== studentId) {
        throw new ForbiddenException('You can only open your own student profile.');
      }
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        branch: { select: { id: true, code: true, name: true } },
        scheme: { select: { id: true, name: true } },
        batch: { select: { id: true, name: true } },
        academicYear: { select: { id: true, year: true } },
      },
    });

    if (!student) {
      throw new NotFoundException('That student no longer exists.');
    }

    /**
     * The branch scope applies to every read.
     *
     * A member whose role assignment has been moved to another branch must
     * not keep reading the old branch's students through this screen.
     */
    if (!isOwnOnlyReader) {
      await this.authorisation.assertBranchVisible(callerId, student.branchId);
    }

    /**
     * What the caller may read of this student's marks.
     *
     * The decision is made here, once, and everything downstream reads it.
     */
    const marksAccess = await this.resolveMarksAccess(callerId, student, permissions);

    const identity = this.buildIdentity(student, permissions, isOwnOnlyReader);

    const profile: StudentProfileView = {
      identity,
      availableActions: this.buildAvailableActions(permissions),
    };

    /**
     * The notice explains any narrowing.
     *
     * It is shown in both cases — when the marks are withheld entirely and
     * when they are narrowed to a teacher's own subjects — because a
     * partially-visible section with no explanation reads as a bug: the
     * reader sees a Sem 5 result with three subjects in it and no way to
     * know why.
     */
    if (marksAccess.notice) {
      profile.restrictedNotice = marksAccess.notice;
    }

    if (!marksAccess.mayReadMarks) {
      /**
       * The record is visible but its academic picture is not. The notice
       * says so in plain language, because an empty section with no
       * explanation reads as a bug.
       */
      return profile;
    }

    const [snapshot, marksHistory, resultHistory, documents, activity] = await Promise.all([
      this.buildAcademicSnapshot(student, marksAccess),
      this.buildMarksHistory(student, marksAccess),
      this.buildResultHistory(student, marksAccess),
      this.buildDocuments(student),
      this.buildActivity(student, permissions),
    ]);

    profile.academic = snapshot;
    profile.marksHistory = marksHistory;
    profile.resultHistory = resultHistory;
    profile.documents = documents;
    profile.activity = activity;

    return profile;
  }

  // ---------------------------------------------------------------------
  // The identity block
  // ---------------------------------------------------------------------

  /**
   * Builds the identity block, applying the PII gate.
   */
  private buildIdentity(
    student: Prisma.StudentGetPayload<{
      include: {
        branch: { select: { id: true; code: true; name: true } };
        scheme: { select: { id: true; name: true } };
        batch: { select: { id: true; name: true } };
        academicYear: { select: { id: true; year: true } };
      };
    }>,
    permissions: string[],
    isOwnOnlyReader: boolean
  ): StudentIdentityView {
    const identity: StudentIdentityView = {
      id: student.id,
      rollNo: student.rollNo,
      name: student.name,
      photoUrl: student.photoUrl,
      initials: initialsOf(student.name),
      branchId: student.branch.id,
      branchCode: student.branch.code,
      branchName: student.branch.name,
      schemeId: student.scheme.id,
      schemeName: student.scheme.name,
      batchId: student.batch.id,
      batchName: student.batch.name,
      semester: student.semester,
      currentYear: yearForSemester(student.semester),
      academicYearId: student.academicYear.id,
      academicYear: student.academicYear.year,
      admissionYear: student.admissionYear,
      section: student.section,
      email: student.email,
      hasLogin: Boolean(student.userId),
      phone: student.phone,
      alternateEmail: student.alternateEmail,
      address: student.address,
      city: student.city,
      state: student.state,
      pincode: student.pincode,
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.toISOString() : null,
      gender: student.gender,
      reservedCategory: student.reservedCategory,
      feeCategory: student.feeCategory,
      scholarshipRecipient: student.scholarshipRecipient,
      status: student.status,
      statusReason: student.statusReason,
      statusDate: student.statusDate ? student.statusDate.toISOString() : null,
    };

    /**
     * The sensitive identity block.
     *
     * Two ways in: the caller holds `students:read_sensitive`, or the caller
     * is reading their *own* record. A student's own identity number is
     * their own business — they are the one person it belongs to.
     */
    if (permissions.includes(STUDENT_PROFILE_PERMISSIONS.READ_SENSITIVE) || isOwnOnlyReader) {
      const sensitive: StudentSensitiveIdentityView = {
        nationalId: student.nationalId,
        bloodGroup: student.bloodGroup,
      };
      identity.sensitive = sensitive;
    }

    /**
     * The guardian block.
     *
     * Same two ways in: the permission, or the caller reading their own
     * record. A student is entitled to know who their recorded guardian is.
     */
    if (permissions.includes(STUDENT_PROFILE_PERMISSIONS.READ_GUARDIAN) || isOwnOnlyReader) {
      const guardians: StudentGuardiansView = {
        primary: guardianView({
          name: student.guardianName,
          relation: student.guardianRelation,
          phone: student.guardianPhone,
          email: student.guardianEmail,
          occupation: student.guardianOccupation,
        }),
        secondary: guardianView({
          name: student.guardian2Name,
          relation: student.guardian2Relation,
          phone: student.guardian2Phone,
          email: student.guardian2Email,
          occupation: student.guardian2Occupation,
        }),
      };
      identity.guardians = guardians;
    }

    return identity;
  }

  // ---------------------------------------------------------------------
  // The marks gate
  // ---------------------------------------------------------------------

  /**
   * Decides what the caller may read of this student's marks.
   */
  private async resolveMarksAccess(
    callerId: string,
    student: {
      id: string;
      branchId: string;
      schemeId: string;
      semester: number;
      academicYearId: string;
    },
    permissions: string[]
  ): Promise<{
    mayReadMarks: boolean;
    /**
     * The offering ids the caller may read the marks of. `undefined` means
     * "every offering" — the whole-college reach.
     */
    offeringIds?: string[];
    notice?: string;
  }> {
    /**
     * A student reading their own profile sees their own marks in full.
     */
    if (permissions.includes(STUDENT_PROFILE_PERMISSIONS.MARKS_READ_OWN)) {
      return { mayReadMarks: true };
    }

    /**
     * The whole-college reach.
     *
     * The question is not "does the caller hold `marks:read`?" — the
     * teacher holds it too. The question is "is the caller bounded by
     * their allocations?"
     *
     * A **teacher** is the one role whose mark rights are exactly
     * `marks:read` and `marks:enter_own_subject`: they may read the
     * subjects they were allocated, and nothing more. Every other role
     * that reads marks holds at least one right that says "the whole
     * picture" — the exam cell writes marks (`marks:write`), the HOD
     * generates reports and reads their own department's analytics
     * (`reports:generate`, `analytics:read_own_department`), and the
     * Principal reads the academic picture without entering anything.
     *
     * So the test is: does the caller hold `marks:read` **without** any
     * of the rights that mean "the whole college"? A Principal fails
     * that test — they hold no right to *enter* a mark — and is therefore
     * not bounded by an allocation.
     */
    const collegeWideRights = [
      STUDENT_PROFILE_PERMISSIONS.MARKS_WRITE,
      STUDENT_PROFILE_PERMISSIONS.REPORTS_GENERATE,
      STUDENT_PROFILE_PERMISSIONS.ANALYTICS_READ_OWN_DEPARTMENT,
      STUDENT_PROFILE_PERMISSIONS.WRITE,
    ];

    const holdsCollegeWideRight = collegeWideRights.some((permission) =>
      permissions.includes(permission)
    );

    /**
     * A **teacher**. Their view is bounded by their allocations.
     *
     * The allocation list is what bounds them: a teacher holds the right to
     * read the marks of the subjects the HOD allocated to them, in the
     * academic years they were allocated in. Nothing else.
     *
     * The test for "is this caller a teacher?" is not the absence of a
     * college-wide right — it is the presence of `marks:enter_own_subject`
     * **without** one. The Principal holds no mark-entry right at all, so
     * they are never narrowed by an allocation.
     */
    const isAllocationBounded =
      permissions.includes(STUDENT_PROFILE_PERMISSIONS.MARKS_ENTER_OWN_SUBJECT) &&
      !holdsCollegeWideRight;

    if (!isAllocationBounded) {
      /**
       * This caller reads the whole picture — the Principal, the exam
       * cell, the HOD, the Super Admin.
       */
      if (permissions.includes(STUDENT_PROFILE_PERMISSIONS.MARKS_READ) || holdsCollegeWideRight) {
        return { mayReadMarks: true };
      }

      return {
        mayReadMarks: false,
        notice:
          'The marks for this student are not shown because your role does not include reading marks.',
      };
    }

    const allocations = await this.prisma.teacherSubject.findMany({
      where: { teacherId: callerId },
      select: { subjectOfferingId: true },
    });

    const allocatedIds = [...new Set(allocations.map((a) => a.subjectOfferingId))];

    if (!allocatedIds.length) {
      return {
        mayReadMarks: false,
        notice:
          'The marks for this student are not shown because you are not allocated to any of their subjects.',
      };
    }

    return {
      mayReadMarks: true,
      offeringIds: allocatedIds,
      notice:
        'Only the subjects you teach are shown. The rest of this student’s marks are not visible to you.',
    };
  }

  // ---------------------------------------------------------------------
  // The academic snapshot
  // ---------------------------------------------------------------------

  /**
   * Builds the academic snapshot: the current semester, its subjects and the
   * student's standing in them.
   */
  private async buildAcademicSnapshot(
    student: {
      id: string;
      branchId: string;
      schemeId: string;
      semester: number;
      academicYearId: string;
    },
    access: { offeringIds?: string[] }
  ): Promise<StudentAcademicSnapshotView> {
    const offerings = await this.prisma.subjectOffering.findMany({
      where: {
        branchId: student.branchId,
        schemeId: student.schemeId,
        semester: student.semester,
        isActive: true,
        OR: [{ academicYearId: null }, { academicYearId: student.academicYearId }],
      },
      include: { subject: true },
      orderBy: { subject: { code: 'asc' } },
    });

    const subjects: StudentEnrolledSubjectView[] = offerings.map((o) => ({
      subjectOfferingId: o.id,
      subjectCode: o.subject.code,
      subjectName: o.subject.name,
      credits: o.subject.credits,
      maxMarks: o.subject.maxMarks,
      passingMarks: o.subject.passingMarks,
    }));

    const totalCredits = subjects.reduce((sum, s) => sum + s.credits, 0);

    /**
     * The marks the caller may see, for this student and the current year.
     *
     * The offering filter is the teacher's boundary: an offering the caller
     * is not allocated to is not read at all.
     */
    const marks = await this.findVisibleMarks({
      studentId: student.id,
      academicYearId: student.academicYearId,
      offeringIds: access.offeringIds,
      offeringIdsInClass: offerings.map((o) => o.id),
    });

    if (!marks.length) {
      return {
        semester: student.semester,
        academicYearId: student.academicYearId,
        academicYear: await this.academicYearLabel(student.academicYearId),
        subjects,
        totalCredits,
        earnedCredits: 0,
        aggregate: null,
        grade: null,
        isPass: null,
        isEvaluated: false,
        failedSubjects: [],
      };
    }

    /**
     * The aggregate is computed over the subjects the caller may see.
     *
     * For a teacher this is the aggregate of *their* subjects, which is the
     * only honest aggregate they are entitled to — adding the whole
     * semester's marks would be reading what they may not read.
     */
    const totals = rollUpMarks(marks, subjects);

    return {
      semester: student.semester,
      academicYearId: student.academicYearId,
      academicYear: await this.academicYearLabel(student.academicYearId),
      subjects,
      totalCredits,
      earnedCredits: totals.earnedCredits,
      aggregate: totals.percentage,
      grade: gradeForPercentage(totals.percentage),
      isPass: totals.failedSubjects.length === 0,
      isEvaluated: true,
      failedSubjects: totals.failedSubjects,
    };
  }

  // ---------------------------------------------------------------------
  // The marks history
  // ---------------------------------------------------------------------

  /**
   * Builds the marks history: every subject, every component, grouped by
   * semester.
   *
   * The semesters come from the **enrolment history**, not from the
   * student's current semester — that is what keeps a Sem 1 result visible
   * after the student has moved to Sem 5 (§2.8.3).
   */
  private async buildMarksHistory(
    student: { id: string; branchId: string; schemeId: string },
    access: { offeringIds?: string[] }
  ): Promise<StudentMarksHistoryGroup[]> {
    const semesters = await this.semestersFor(student.id);

    if (!semesters.length) return [];

    const marks = await this.findVisibleMarks({
      studentId: student.id,
      offeringIds: access.offeringIds,
      semesters,
    });

    /**
     * The subjects behind the marks, so the history can show the subject's
     * name, its maximum and its passing mark alongside the score.
     */
    const offeringIds = [...new Set(marks.map((m) => m.subjectOfferingId))];
    const offerings = offeringIds.length
      ? await this.prisma.subjectOffering.findMany({
          where: { id: { in: offeringIds } },
          include: { subject: true },
        })
      : [];

    const offeringById = new Map(offerings.map((o) => [o.id, o]));

    const groups: StudentMarksHistoryGroup[] = [];

    for (const semester of semesters) {
      const semesterMarks = marks.filter((m) => m.semester === semester.semester);

      if (!semesterMarks.length) continue;

      const subjectRows = new Map<string, StudentSubjectMarksView>();

      for (const mark of semesterMarks) {
        const offering = offeringById.get(mark.subjectOfferingId);
        if (!offering) continue;

        const row =
          subjectRows.get(mark.subjectOfferingId) ??
          ({
            subjectOfferingId: mark.subjectOfferingId,
            subjectCode: offering.subject.code,
            subjectName: offering.subject.name,
            semester: semester.semester,
            academicYearId: semester.academicYearId,
            academicYear: semester.academicYear,
            credits: offering.subject.credits,
            maxMarks: offering.subject.maxMarks,
            passingMarks: offering.subject.passingMarks,
            totalObtained: 0,
            totalMax: 0,
            percentage: null,
            isPass: null,
            reason: null,
            components: [],
          } satisfies StudentSubjectMarksView);

        const component: StudentMarkComponentView = {
          examType: mark.examType,
          marksObtained: mark.isAbsent ? 0 : mark.marksObtained,
          maxMarks: mark.maxMarks,
          isAbsent: mark.isAbsent,
          isWithheld: mark.isWithheld,
          remarks: mark.remarks,
        };

        row.components.push(component);
        row.totalObtained += component.marksObtained;
        row.totalMax += component.maxMarks;

        subjectRows.set(mark.subjectOfferingId, row);
      }

      for (const row of subjectRows.values()) {
        row.percentage = row.totalMax > 0 ? round((row.totalObtained / row.totalMax) * 100) : null;
        /**
         * The subject's own configured passing mark decides the verdict, so
         * the history matches the subject as it was set up rather than a
         * rule invented here.
         */
        row.isPass = row.percentage === null ? null : row.totalObtained >= row.passingMarks;
        if (row.isPass === false) {
          row.reason = `Scored ${row.totalObtained} of ${row.totalMax}; the pass mark is ${row.passingMarks}.`;
        }
      }

      groups.push({
        semester: semester.semester,
        academicYearId: semester.academicYearId,
        academicYear: semester.academicYear,
        subjects: [...subjectRows.values()].sort((a, b) =>
          a.subjectCode.localeCompare(b.subjectCode)
        ),
      });
    }

    return groups;
  }

  // ---------------------------------------------------------------------
  // The result history
  // ---------------------------------------------------------------------

  /**
   * Builds the result history — one row per semester, with the state of the
   * examination the result belongs to.
   */
  private async buildResultHistory(
    student: { id: string; branchId: string; schemeId: string },
    access: { offeringIds?: string[] }
  ): Promise<StudentResultHistoryEntryView[]> {
    const semesters = await this.semestersFor(student.id);
    if (!semesters.length) return [];

    const entries: StudentResultHistoryEntryView[] = [];

    for (const semester of semesters) {
      const marks = await this.findVisibleMarks({
        studentId: student.id,
        offeringIds: access.offeringIds,
        semesters: [semester],
      });

      const schemeName = await this.schemeName(student.schemeId);
      const examination = await this.prisma.examination.findUnique({
        where: {
          branchId_semester_schemeId_academicYearId: {
            branchId: student.branchId,
            semester: semester.semester,
            schemeId: student.schemeId,
            academicYearId: semester.academicYearId,
          },
        },
        select: { name: true, status: true, resultPublishedAt: true },
      });

      if (!marks.length) {
        /**
         * A semester with no marks at all still belongs in the history — the
         * fact that nothing was recorded is itself information, and a
         * history with a gap is more honest than one without.
         */
        entries.push({
          semester: semester.semester,
          academicYearId: semester.academicYearId,
          academicYear: semester.academicYear,
          schemeName,
          totalMarks: 0,
          maxTotalMarks: 0,
          aggregate: null,
          grade: null,
          creditsEarned: 0,
          totalCredits: 0,
          isPass: null,
          examinationStatus: examination?.status ?? null,
          examinationName: examination?.name ?? null,
          resultPublishedAt: examination?.resultPublishedAt
            ? examination.resultPublishedAt.toISOString()
            : null,
        });
        continue;
      }

      const offerings = await this.prisma.subjectOffering.findMany({
        where: { id: { in: [...new Set(marks.map((m) => m.subjectOfferingId))] } },
        include: { subject: true },
      });

      const subjects: StudentEnrolledSubjectView[] = offerings.map((o) => ({
        subjectOfferingId: o.id,
        subjectCode: o.subject.code,
        subjectName: o.subject.name,
        credits: o.subject.credits,
        maxMarks: o.subject.maxMarks,
        passingMarks: o.subject.passingMarks,
      }));

      const totals = rollUpMarks(marks, subjects);

      entries.push({
        semester: semester.semester,
        academicYearId: semester.academicYearId,
        academicYear: semester.academicYear,
        schemeName,
        totalMarks: totals.totalMarks,
        maxTotalMarks: totals.maxTotalMarks,
        aggregate: totals.percentage,
        grade: gradeForPercentage(totals.percentage),
        creditsEarned: totals.earnedCredits,
        totalCredits: totals.totalCredits,
        isPass: totals.failedSubjects.length === 0,
        examinationStatus: examination?.status ?? null,
        examinationName: examination?.name ?? null,
        resultPublishedAt: examination?.resultPublishedAt
          ? examination.resultPublishedAt.toISOString()
          : null,
      });
    }

    return entries;
  }

  // ---------------------------------------------------------------------
  // The documents
  // ---------------------------------------------------------------------

  /**
   * The documents attached to this student.
   *
   * The system stores documents in two places: the reports it generated for
   * this student's class, and the upload jobs whose extraction named this
   * student. Both are read here, and both are labelled in the language of
   * the college.
   */
  private async buildDocuments(student: {
    id: string;
    branchId: string;
  }): Promise<StudentDocumentView[]> {
    const documents: StudentDocumentView[] = [];

    /**
     * The generated reports for this student's class.
     *
     * A report carries no student id of its own — it carries the class it
     * was generated for. The reports that mention this student are the ones
     * whose filters name their branch, which is the finest grain the
     * report model offers.
     */
    const reports = await this.prisma.report.findMany({
      where: {
        filters: {
          path: ['branchId'],
          equals: student.branchId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    for (const report of reports) {
      documents.push({
        id: report.id,
        kind: 'Generated report',
        title: reportTitle(report.type),
        createdAt: report.createdAt.toISOString(),
        status: reportStatus(report.status),
        fileUrl: report.fileUrl,
      });
    }

    /**
     * The upload jobs that produced this student's marks.
     */
    const uploads = await this.prisma.uploadJob.findMany({
      where: {
        metadata: {
          path: ['studentIds'],
          array_contains: [student.id],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    for (const upload of uploads) {
      documents.push({
        id: upload.id,
        kind: 'Uploaded mark statement',
        title: upload.fileName,
        createdAt: upload.createdAt.toISOString(),
        status: uploadStatus(upload.status),
        fileUrl: upload.fileUrl,
      });
    }

    return documents.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // ---------------------------------------------------------------------
  // The activity trail
  // ---------------------------------------------------------------------

  /**
   * The audit trail for this student — who changed their data, and when.
   *
   * The trail is only readable by a caller who may read the audit log at
   * all. The Principal holds `audit:read` (§7.18 names the Principal as one
   * of the two roles that need to see who changed what); the exam cell does
   * not, so it sees the *records* rather than the trail.
   */
  private async buildActivity(
    student: { id: string },
    permissions: string[]
  ): Promise<StudentActivityView[] | undefined> {
    if (!permissions.includes(STUDENT_PROFILE_PERMISSIONS.AUDIT_READ)) {
      return undefined;
    }

    const entries = await this.prisma.auditLog.findMany({
      where: { resource: 'student', resourceId: student.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { name: true } } },
    });

    return entries.map((entry) => ({
      id: entry.id,
      action: auditActionLabel(entry.action),
      actorName: entry.user?.name ?? null,
      createdAt: entry.createdAt.toISOString(),
      details: auditDetailLabel(entry.details),
    }));
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  /**
   * The semesters the student has been enrolled in.
   *
   * The enrolment history is the source of truth (§2.8.3). A student who
   * has only ever been in one semester has one enrolment row, and a
   * student who has advanced has one row per semester.
   */
  private async semestersFor(
    studentId: string
  ): Promise<Array<{ semester: number; academicYearId: string; academicYear: string }>> {
    const rows = await this.prisma.studentEnrollment.findMany({
      where: { studentId },
      include: { academicYear: { select: { year: true } } },
      orderBy: [{ academicYearId: 'asc' }, { semester: 'asc' }],
    });

    return rows.map((r) => ({
      semester: r.semester,
      academicYearId: r.academicYearId,
      academicYear: r.academicYear.year,
    }));
  }

  /**
   * Reads the marks the caller may see.
   *
   * The offering filter is the caller's boundary: an offering they are not
   * allocated to is never read.
   */
  private async findVisibleMarks(params: {
    studentId: string;
    academicYearId?: string;
    offeringIds?: string[];
    semesters?: Array<{ semester: number; academicYearId: string }>;
    offeringIdsInClass?: string[];
  }): Promise<
    Array<
      Mark & {
        semester: number;
        subjectOfferingId: string;
      }
    >
  > {
    /**
     * The offering ids the marks may come from.
     *
     * When the caller has a bounded set (a teacher), the marks must come
     * from it. When the caller has the whole-college reach, the offering
     * set is the class's own offerings.
     */
    let offeringIds: string[] | undefined = params.offeringIds;

    if (!offeringIds && params.offeringIdsInClass) {
      offeringIds = params.offeringIdsInClass;
    }

    if (offeringIds && !offeringIds.length) return [];

    const where: Prisma.MarkWhereInput = {
      studentId: params.studentId,
      ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
      ...(offeringIds ? { subjectOfferingId: { in: offeringIds } } : {}),
      ...(params.semesters?.length
        ? {
            OR: params.semesters.map((s) => ({
              academicYearId: s.academicYearId,
              subjectOffering: { semester: s.semester },
            })),
          }
        : {}),
    };

    const rows = await this.prisma.mark.findMany({
      where,
      include: { subjectOffering: { select: { semester: true } } },
      orderBy: { subjectOfferingId: 'asc' },
    });

    return rows.map((row) => ({
      ...row,
      semester: row.subjectOffering.semester,
    }));
  }

  /** The label of an academic year. */
  private async academicYearLabel(academicYearId: string): Promise<string> {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { year: true },
    });
    return year?.year ?? '';
  }

  /** The name of a scheme. */
  private async schemeName(schemeId: string): Promise<string> {
    const scheme = await this.prisma.scheme.findUnique({
      where: { id: schemeId },
      select: { name: true },
    });
    return scheme?.name ?? '';
  }

  /**
   * The actions this caller may take on a student.
   *
   * The list is computed on the server, so the screen never offers a button
   * the server would refuse.
   */
  private buildAvailableActions(permissions: string[]): string[] {
    const actions: string[] = [];

    if (permissions.includes(STUDENT_PROFILE_PERMISSIONS.WRITE)) {
      actions.push('edit', 'archive', 'provision-login');
    }
    if (permissions.includes(STUDENT_PROFILE_PERMISSIONS.BULK_PROVISION)) {
      actions.push('bulk-provision');
    }
    if (permissions.includes(STUDENT_PROFILE_PERMISSIONS.REPORTS_GENERATE)) {
      actions.push('generate-report');
    }
    if (permissions.includes(STUDENT_PROFILE_PERMISSIONS.REPORTS_DOWNLOAD)) {
      actions.push('export-result');
    }

    return actions;
  }
}

/**
 * The initials to show when a student has no photograph.
 *
 * Up to two letters, from the first and the last word of the name, so
 * "Aarav Sharma" reads "AS" and not "AA".
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Builds a guardian view, or `null` when no guardian is recorded.
 */
function guardianView(fields: {
  name: string | null;
  relation: string | null;
  phone: string | null;
  email: string | null;
  occupation: string | null;
}): StudentGuardianView | null {
  if (!fields.name && !fields.relation && !fields.phone && !fields.email && !fields.occupation) {
    return null;
  }
  return {
    name: fields.name,
    relation: fields.relation as StudentGuardianView['relation'],
    phone: fields.phone,
    email: fields.email,
    occupation: fields.occupation,
  };
}

/**
 * Rolls a set of marks up into the totals the profile shows.
 */
function rollUpMarks(
  marks: Array<{
    subjectOfferingId: string;
    marksObtained: number;
    maxMarks: number;
    isAbsent: boolean;
  }>,
  subjects: StudentEnrolledSubjectView[]
): {
  totalMarks: number;
  maxTotalMarks: number;
  percentage: number | null;
  earnedCredits: number;
  totalCredits: number;
  failedSubjects: Array<{ subjectCode: string; subjectName: string; reason: string }>;
} {
  const passingByOffering = new Map(subjects.map((s) => [s.subjectOfferingId, s.passingMarks]));
  const creditsByOffering = new Map(subjects.map((s) => [s.subjectOfferingId, s.credits]));
  const codeByOffering = new Map(subjects.map((s) => [s.subjectOfferingId, s.subjectCode]));
  const nameByOffering = new Map(subjects.map((s) => [s.subjectOfferingId, s.subjectName]));

  let totalMarks = 0;
  let maxTotalMarks = 0;
  const scored = new Set<string>();
  const failedSubjects: Array<{ subjectCode: string; subjectName: string; reason: string }> = [];

  for (const mark of marks) {
    scored.add(mark.subjectOfferingId);
    if (mark.isAbsent) continue;
    totalMarks += mark.marksObtained;
    maxTotalMarks += mark.maxMarks;
  }

  let earnedCredits = 0;
  for (const subject of subjects) {
    if (!scored.has(subject.subjectOfferingId)) continue;
    const passing = passingByOffering.get(subject.subjectOfferingId) ?? 0;
    const subjectTotal = marks
      .filter((m) => m.subjectOfferingId === subject.subjectOfferingId && !m.isAbsent)
      .reduce((sum, m) => sum + m.marksObtained, 0);

    if (subjectTotal >= passing) {
      earnedCredits += creditsByOffering.get(subject.subjectOfferingId) ?? 0;
    } else {
      failedSubjects.push({
        subjectCode: codeByOffering.get(subject.subjectOfferingId) ?? subject.subjectCode,
        subjectName: nameByOffering.get(subject.subjectOfferingId) ?? subject.subjectName,
        reason: `Scored ${subjectTotal}; the pass mark is ${passing}.`,
      });
    }
  }

  return {
    totalMarks: round(totalMarks),
    maxTotalMarks: round(maxTotalMarks),
    percentage: maxTotalMarks > 0 ? round((totalMarks / maxTotalMarks) * 100) : null,
    earnedCredits,
    totalCredits: subjects.reduce((sum, s) => sum + s.credits, 0),
    failedSubjects,
  };
}

/**
 * Rounds to two decimal places, avoiding `-0` and `NaN`.
 */
function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(2));
}

/**
 * The title of a generated report, in the language of the college.
 */
function reportTitle(type: string): string {
  const titles: Record<string, string> = {
    STUDENT_WISE: 'Student-wise marksheet',
    SCHEME_WISE: 'Scheme-wise result',
    SUBJECT_ANALYSIS: 'Subject analysis',
    STUDENT_ANALYSIS: 'Student analysis',
    CLASS_TOPPERS: 'Class toppers',
    PASS_FAIL: 'Pass and fail list',
    COMPLETE: 'Complete result booklet',
  };
  return titles[type] ?? 'Generated report';
}

/**
 * The status of a generated report, in the language of the college.
 */
function reportStatus(status: string): string {
  const statuses: Record<string, string> = {
    PENDING: 'Being prepared',
    PROCESSING: 'Being prepared',
    COMPLETED: 'Ready',
    FAILED: 'Could not be prepared',
  };
  return statuses[status] ?? 'Ready';
}

/**
 * The status of an upload job, in the language of the college.
 */
function uploadStatus(status: string): string {
  const statuses: Record<string, string> = {
    PENDING: 'Waiting to be processed',
    PROCESSING: 'Being read',
    EXTRACTED: 'Read',
    FAILED: 'Could not be read',
    COMPLETED: 'Completed',
  };
  return statuses[status] ?? 'Completed';
}

/**
 * The label of an audit action, in the language of the college.
 */
function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    CREATE: 'Record created',
    UPDATE: 'Record updated',
    DELETE: 'Record deleted',
    BULK_IMPORT: 'Records imported',
    CORRECTION: 'Marks corrected',
    GRANT: 'Role granted',
    REVOKE: 'Role revoked',
    DEACTIVATE: 'Access revoked',
    ARCHIVE: 'Record archived',
  };
  return labels[action] ?? action;
}

/**
 * A one-line summary of an audit row's details.
 *
 * The details column is a JSON blob; the trail shows a readable line
 * rather than the raw JSON, because a clerk is not a developer.
 */
function auditDetailLabel(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;

  const record = details as Record<string, unknown>;
  const parts: string[] = [];

  const event = record.event;
  if (typeof event === 'string') {
    const events: Record<string, string> = {
      STUDENT_LOGIN_PROVISIONED: 'A login was created',
      STUDENT_LOGIN_LINKED: 'A login was linked',
      STUDENT_BULK_PROVISIONED: 'Logins were created for the class',
    };
    parts.push(events[event] ?? event);
  }

  if (typeof record.rollNo === 'string') parts.push(`Roll number ${record.rollNo}`);
  if (typeof record.reason === 'string') parts.push(`Reason: ${record.reason}`);

  return parts.length ? parts.join(' · ') : null;
}
