import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Mark, Student } from '@prisma/client';
import { MarksService } from '../marks/marks.service';
import type { StudentCalculationResult, SubjectOfferingContext } from '../marks/calculator';

/**
 * The message used whenever a caller has no student record linked to their
 * account. One constant, so the wording cannot drift between endpoints.
 */
export const NO_LINKED_STUDENT_MESSAGE =
  'No student record is linked to your account. Please contact the examination cell.';

/**
 * The class scope of a student: the four fields that together identify a
 * class. Derived from the student's own record — never from request input.
 */
export interface StudentClassScope {
  branchId: string;
  schemeId: string;
  semester: number;
  academicYearId: string;
}

/**
 * A subject row prepared for the calculators.
 *
 * The calculators work on *offerings* — the subject as it runs in one
 * branch, semester and scheme — because that is the unit marks hang off.
 * This alias keeps the service's own vocabulary aligned with theirs.
 */
export type CalculatorSubject = SubjectOfferingContext;

/**
 * A mark prepared for the calculators.
 *
 * A mark carries `subjectOfferingId` natively, so no rewriting is needed —
 * the type alias exists only to keep the calculator's signature honest about
 * what it consumes.
 */
export type CalculatorMark = Mark;

/** The subject identity as reported to the student. */
export interface MyResultSubject {
  subjectCode: string;
  subjectName: string;
  credits: number;
  examType: string;
  marksObtained: number;
  maxMarks: number;
  isAbsent: boolean;
  isWithheld: boolean;
}

/** The aggregate outcome of a student's result. */
export interface MyResultTotals {
  totalMarks: number;
  totalMaxMarks: number;
  percentage: number;
  creditsEarned: number;
  totalCredits: number;
  isPass: boolean;
  failedSubjects: Array<{ subjectCode: string; subjectName: string; reason: string }>;
}

/** The response of `GET /my-result`. */
export interface MyResultResponse {
  student: {
    id: string;
    rollNo: string;
    name: string;
    branch: string;
    semester: number;
    /** The year of study (1, 2, 3, 4). */
    year: number;
    scheme: string;
    /** The academic year the result belongs to, e.g. "2024-25". */
    academicYear: string;
  };
  /** The examination the result was declared under. */
  examination: {
    name: string;
    status: string;
    resultPublishedAt: string | null;
  };
  marks: MyResultSubject[];
  totals: MyResultTotals;
}

/** The response of `GET /my-toppers`. */
export interface MyToppersResponse {
  class: {
    branch: string;
    semester: number;
    scheme: string;
    academicYear: string;
  };
  toppers: Array<{
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

@Injectable()
export class StudentSelfService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly marksService: MarksService
  ) {}

  /**
   * Resolves the student record that belongs to a logged-in user.
   *
   * The link is `Student.userId` — the exam cell provisions it. A user with
   * no linked student record simply has no academic identity, so `null` is
   * returned rather than an exception; callers decide whether a missing
   * record is an error.
   */
  async resolveStudentForUser(userId: string): Promise<Student | null> {
    if (!userId) return null;

    return this.prisma.student.findFirst({
      where: { userId, isActive: true },
    });
  }

  /**
   * Same as {@link resolveStudentForUser} but throws when there is no linked
   * record — for the endpoints where a student record is mandatory.
   */
  async requireStudentForUser(userId: string): Promise<Student> {
    const student = await this.resolveStudentForUser(userId);
    if (!student) {
      throw new NotFoundException(NO_LINKED_STUDENT_MESSAGE);
    }
    return student;
  }

  /**
   * The class scope of a student, taken entirely from their own record.
   *
   * This is the security boundary for the toppers endpoint: a student can
   * never widen the window by passing query parameters.
   */
  async classScopeForStudent(student: Student): Promise<StudentClassScope> {
    return {
      branchId: student.branchId,
      schemeId: student.schemeId,
      semester: student.semester,
      academicYearId: student.academicYearId,
    };
  }

  /**
   * Verifies that the requested student belongs to the caller.
   *
   * A student account may only read its own record. Any other id is a
   * `ForbiddenException` — not a `NotFoundException` — because the record
   * does exist; the caller simply is not allowed to see it.
   */
  async assertOwnsStudent(userId: string, studentId: string): Promise<Student> {
    const own = await this.resolveStudentForUser(userId);
    if (!own) {
      throw new NotFoundException(NO_LINKED_STUDENT_MESSAGE);
    }
    if (own.id !== studentId) {
      throw new ForbiddenException('You can only access your own student record');
    }
    return own;
  }

  /**
   * Builds the full "my result" payload for the logged-in student.
   *
   * The calculation is delegated to the scheme-aware calculators through
   * `MarksService.getFactory()` — no second calculation engine lives here.
   */
  async buildMyResult(userId: string): Promise<MyResultResponse> {
    const student = await this.requireStudentForUser(userId);

    const [branch, scheme, academicYear, examination] = await Promise.all([
      this.prisma.branch.findUnique({
        where: { id: student.branchId },
        select: { name: true },
      }),
      this.prisma.scheme.findUnique({
        where: { id: student.schemeId },
        select: { name: true },
      }),
      this.prisma.academicYear.findUnique({
        where: { id: student.academicYearId },
        select: { year: true },
      }),
      this.prisma.examination.findUnique({
        where: {
          branchId_semester_schemeId_academicYearId: {
            branchId: student.branchId,
            semester: student.semester,
            schemeId: student.schemeId,
            academicYearId: student.academicYearId,
          },
        },
        select: { name: true, status: true, resultPublishedAt: true },
      }),
    ]);

    /**
     * A result is only visible once it has been declared for the class.
     *
     * The examination row carries the publication state. When there is no
     * examination for the class, the result has not been scheduled at all,
     * and the student is told so rather than being shown a zeroed marksheet
     * that reads like a fail.
     */
    if (!examination) {
      throw new NotFoundException(
        'No examination has been scheduled for your class yet, so there is no result to show.'
      );
    }
    if (examination.status !== 'PUBLISHED' || !examination.resultPublishedAt) {
      throw new NotFoundException(
        'Your result has not been declared yet. Please check back once it is published.'
      );
    }

    const { subjects, marks } = await this.loadClassMarks(
      student.branchId,
      student.schemeId,
      student.semester,
      student.academicYearId,
      student.id
    );

    const calculation = this.calculate(scheme?.name ?? '', student.id, marks, subjects);

    return {
      student: {
        id: student.id,
        rollNo: student.rollNo,
        name: student.name,
        branch: branch?.name ?? '',
        semester: student.semester,
        year: student.currentYear,
        scheme: scheme?.name ?? '',
        academicYear: academicYear?.year ?? '',
      },
      examination: {
        name: examination.name,
        status: examination.status,
        resultPublishedAt: examination.resultPublishedAt
          ? examination.resultPublishedAt.toISOString()
          : null,
      },
      marks: this.buildMarkRows(marks, subjects),
      totals: this.buildTotals(calculation),
    };
  }

  /**
   * Builds the "my toppers" payload: the leaderboard of the student's OWN
   * class, scoped from their own record.
   */
  async buildMyToppers(userId: string, limit?: number): Promise<MyToppersResponse> {
    const student = await this.requireStudentForUser(userId);
    const scope = await this.classScopeForStudent(student);

    const [branch, scheme, academicYear] = await Promise.all([
      this.prisma.branch.findUnique({
        where: { id: scope.branchId },
        select: { name: true },
      }),
      this.prisma.scheme.findUnique({
        where: { id: scope.schemeId },
        select: { name: true },
      }),
      this.prisma.academicYear.findUnique({
        where: { id: scope.academicYearId },
        select: { year: true },
      }),
    ]);

    /**
     * The leaderboard is derived from the class's marks, so it stays hidden
     * until the result is declared. Publishing the toppers while the marks
     * are still being entered would tell every student in the class what
     * their classmates have scored before the exam cell has released
     * anything.
     */
    await this.assertResultPublished(scope);

    const toppers = await this.rankClass(scope, limit);

    return {
      class: {
        branch: branch?.name ?? '',
        semester: scope.semester,
        scheme: scheme?.name ?? '',
        academicYear: academicYear?.year ?? '',
      },
      toppers,
    };
  }

  /**
   * Throws unless the result for a class context has been declared.
   *
   * The examination row is the source of truth for publication state: it
   * carries the status (`PENDING` → `PROCESSING` → `PUBLISHED`) and the
   * moment the result went live.
   */
  private async assertResultPublished(scope: StudentClassScope): Promise<void> {
    const examination = await this.prisma.examination.findUnique({
      where: {
        branchId_semester_schemeId_academicYearId: {
          branchId: scope.branchId,
          semester: scope.semester,
          schemeId: scope.schemeId,
          academicYearId: scope.academicYearId,
        },
      },
      select: { status: true, resultPublishedAt: true },
    });

    if (!examination) {
      throw new NotFoundException(
        'No examination has been scheduled for your class yet, so there are no toppers to show.'
      );
    }
    if (examination.status !== 'PUBLISHED' || !examination.resultPublishedAt) {
      throw new NotFoundException(
        'The results for your class have not been declared yet. Please check back once they are published.'
      );
    }
  }

  /**
   * Ranks the whole class using the scheme-aware calculator.
   *
   * The class is resolved from the student's own record, so a student sees
   * the same ranking their class teacher and HOD see — no more, no less.
   */
  private async rankClass(
    scope: StudentClassScope,
    limit?: number
  ): Promise<MyToppersResponse['toppers']> {
    const { subjects, marks } = await this.loadClassMarks(
      scope.branchId,
      scope.schemeId,
      scope.semester,
      scope.academicYearId
    );

    const students = await this.prisma.student.findMany({
      where: {
        branchId: scope.branchId,
        schemeId: scope.schemeId,
        semester: scope.semester,
        academicYearId: scope.academicYearId,
        isActive: true,
      },
      select: { id: true, rollNo: true, name: true },
      orderBy: { rollNo: 'asc' },
    });

    const scheme = await this.prisma.scheme.findUnique({
      where: { id: scope.schemeId },
      select: { name: true },
    });

    const marksByStudent = new Map<string, CalculatorMark[]>();
    for (const mark of marks) {
      const list = marksByStudent.get(mark.studentId) ?? [];
      list.push(mark);
      marksByStudent.set(mark.studentId, list);
    }

    const ranked = students
      .map((student) => {
        const calculation = this.calculate(
          scheme?.name ?? '',
          student.id,
          marksByStudent.get(student.id) ?? [],
          subjects
        );
        return {
          studentId: student.id,
          rollNo: student.rollNo,
          name: student.name,
          totalMarks: calculation.totalObtained,
          maxTotalMarks: calculation.totalMax,
          percentage: this.round(calculation.overallPercentage),
          creditsEarned: calculation.earnedCredits,
        };
      })
      .sort((a, b) => b.percentage - a.percentage || b.totalMarks - a.totalMarks);

    const capped = limit && limit > 0 ? ranked.slice(0, limit) : ranked;
    return capped.map((entry, index) => ({ rank: index + 1, ...entry }));
  }

  /**
   * Loads the subject offerings and marks for a class context.
   *
   * After the Subject/SubjectOffering split the class context lives on the
   * offering (`branchId`, `semester`, `schemeId`), while the subject keeps
   * the template (`credits`, `maxMarks`, `components`). Both are loaded here
   * and handed to the calculator as one merged row.
   *
   * When `studentId` is supplied only that student's marks are returned —
   * the "my result" path.
   */
  private async loadClassMarks(
    branchId: string,
    schemeId: string,
    semester: number,
    academicYearId: string,
    studentId?: string
  ): Promise<{ subjects: CalculatorSubject[]; marks: CalculatorMark[] }> {
    const rows = await this.prisma.subjectOffering.findMany({
      where: {
        branchId,
        schemeId,
        semester,
        isActive: true,
        // An offering with no academic year applies to every year.
        OR: [{ academicYearId: null }, { academicYearId }],
      },
      include: { subject: true },
      orderBy: { subject: { code: 'asc' } },
    });

    const subjects: CalculatorSubject[] = rows.map((o) => ({
      id: o.id,
      semester: o.semester,
      subject: o.subject,
    }));

    const offeringIds = rows.map((o) => o.id);

    const marks: CalculatorMark[] = offeringIds.length
      ? await this.prisma.mark.findMany({
          where: {
            subjectOfferingId: { in: offeringIds },
            academicYearId,
            ...(studentId ? { studentId } : {}),
          },
        })
      : [];

    return { subjects, marks };
  }

  /**
   * Runs the scheme-aware calculator over a set of subject offerings and
   * marks. This is the only calculation path — the rules live in
   * `marks/calculator`, not here.
   */
  private calculate(
    schemeName: string,
    studentId: string,
    marks: CalculatorMark[],
    subjects: CalculatorSubject[]
  ): StudentCalculationResult {
    const factory = this.marksService.getFactory();

    /**
     * The factory raises a `BadRequestException` for a scheme it does not
     * implement. A student should not see a raw scheme name in an error, so
     * the failure is translated into a message the examination cell can act
     * on.
     */
    if (!factory.listSupported().includes(schemeName.toUpperCase())) {
      throw new NotFoundException(
        'No result could be computed for your class. Please contact the examination cell.'
      );
    }

    const calculator = factory.get(schemeName);
    return calculator.calculateStudentResult(studentId, marks, subjects);
  }

  /**
   * Flattens the prepared marks into the row shape the student sees.
   *
   * One row per mark entry (exam component), which is what a marksheet shows.
   */
  private buildMarkRows(marks: CalculatorMark[], subjects: CalculatorSubject[]): MyResultSubject[] {
    const subjectByOfferingId = new Map(subjects.map((s) => [s.id, s.subject]));

    return marks
      .map((mark) => {
        const subject = subjectByOfferingId.get(mark.subjectOfferingId);
        return {
          subjectCode: subject?.code ?? '',
          subjectName: subject?.name ?? '',
          credits: subject?.credits ?? 0,
          examType: mark.examType,
          marksObtained: mark.isAbsent ? 0 : mark.marksObtained,
          maxMarks: mark.maxMarks,
          isAbsent: mark.isAbsent,
          isWithheld: mark.isWithheld,
        };
      })
      .sort(
        (a, b) => a.subjectCode.localeCompare(b.subjectCode) || a.examType.localeCompare(b.examType)
      );
  }

  /**
   * Builds the aggregate totals, including the list of failed subjects.
   *
   * The calculator already reports the subject's code and name alongside
   * each result, so no lookup is needed here.
   */
  private buildTotals(calculation: StudentCalculationResult): MyResultTotals {
    const failedSubjects = calculation.subjectResults
      .filter((result) => !result.isPass)
      .map((result) => ({
        subjectCode: result.subjectCode,
        subjectName: result.subjectName,
        reason: result.reason,
      }));

    return {
      totalMarks: calculation.totalObtained,
      totalMaxMarks: calculation.totalMax,
      percentage: this.round(calculation.overallPercentage),
      creditsEarned: calculation.earnedCredits,
      totalCredits: calculation.totalCredits,
      isPass: calculation.isOverallPass,
      failedSubjects,
    };
  }

  /** Rounds to two decimal places, avoiding `-0` and `NaN`. */
  private round(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Number(value.toFixed(2));
  }
}
