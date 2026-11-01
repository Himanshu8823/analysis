import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassOverviewRepository, MyClassAssignment } from './class-overview.repository';
import { ScopeService } from '@/common/services/scope.service';

/**
 * The class a member is the class teacher of.
 */
export interface MyClassSummary {
  id: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  semester: number;
  schemeId: string;
  schemeName: string;
  academicYearId: string;
  academicYearLabel: string;
  studentCount: number;
}

/**
 * The headline numbers of a class.
 */
export interface ClassStats {
  /** How many students are in the class. */
  studentCount: number;
  /** How many subjects the class is running. */
  subjectCount: number;
  /** The class average, as a percentage of the marks recorded. */
  averagePercentage: number;
  /** The highest percentage in the class. */
  highestPercentage: number;
  /** The lowest percentage among the students who have marks. */
  lowestPercentage: number;
  /** How many students have marks for every subject. */
  studentsWithFullMarks: number;
  /** How many students have no mark at all yet. */
  studentsWithoutAnyMarks: number;
  /** How many students have a mark missing for at least one subject. */
  studentsWithMissingMarks: number;
  /** How many students passed every subject they were marked in. */
  passedCount: number;
  /** How many students failed at least one subject. */
  failedCount: number;
}

/**
 * The full class overview: the roster with each student's standing, and the
 * per-subject standing of the class.
 */
export interface ClassOverview {
  class: MyClassSummary;
  stats: ClassStats;
  subjects: Array<{
    subjectOfferingId: string;
    subjectCode: string;
    subjectName: string;
    studentsWithMarks: number;
    averagePercentage: number;
    highestMarks: number;
    highestScorerName: string | null;
    highestScorerRollNo: string | null;
    passCount: number;
  }>;
  students: Array<{
    id: string;
    rollNo: string;
    name: string;
    currentYear: number;
    semester: number;
    totalMarks: number;
    maxTotalMarks: number;
    percentage: number;
    subjectsWithMarks: number;
    missingSubjects: string[];
    /** The subjects this student scored below the passing mark in. */
    failedSubjects: string[];
  }>;
}

@Injectable()
export class ClassOverviewService {
  constructor(
    private readonly repository: ClassOverviewRepository,
    private readonly scope: ScopeService
  ) {}

  /**
   * The classes the signed-in member is the class teacher of.
   *
   * The list is built from the member's own `ClassTeacherAssignment` rows, so
   * it can only ever contain classes they teach. A member with no such row
   * gets an empty list — which the page renders as "you are not a class
   * teacher", rather than as an error.
   */
  async listMyClasses(userId: string): Promise<MyClassSummary[]> {
    const assignments = await this.repository.findClassesTaughtBy(userId);
    if (!assignments.length) return [];

    return Promise.all(
      assignments.map(async (assignment) => ({
        ...toSummary(assignment),
        studentCount: await this.countStudents(assignment),
      }))
    );
  }

  /**
   * The overview of one of the signed-in member's classes.
   *
   * The class is identified by the id of the assignment, not by its branch
   * and semester, so the client cannot address a class the member does not
   * teach — the lookup is by `teacherId` and a class they do not hold simply
   * is not found.
   */
  async getClassOverview(userId: string, assignmentId: string): Promise<ClassOverview> {
    const assignments = await this.repository.findClassesTaughtBy(userId);
    const assignment = assignments.find((a) => a.id === assignmentId);

    if (!assignment) {
      throw new NotFoundException('Class not found in your assigned classes');
    }

    /**
     * A class teacher is read-only here, but the read still goes through the
     * branch scope: a member whose role assignment was moved to another
     * branch must not keep reading the old class through this screen.
     */
    await this.scope.resolveBranchScope(userId, assignment.branchId);

    const offerings = await this.repository.findClassSubjectOfferings({
      branchId: assignment.branchId,
      semester: assignment.semester,
      schemeId: assignment.schemeId,
    });

    const students = await this.repository.findClassStudentsWithMarks({
      branchId: assignment.branchId,
      semester: assignment.semester,
      schemeId: assignment.schemeId,
      academicYearId: assignment.academicYearId,
      offerings: offerings.map((o) => ({
        id: o.id,
        subjectCode: o.subjectCode,
        passingMarks: o.passingMarks,
      })),
    });

    const subjects = await this.repository.findClassSubjectSummaries({
      subjectOfferingIds: offerings.map((o) => o.id),
      academicYearId: assignment.academicYearId,
      studentIds: students.map((s) => s.id),
      offerings: offerings.map((o) => ({
        id: o.id,
        subjectCode: o.subjectCode,
        subjectName: o.subjectName,
        passingMarks: o.passingMarks,
      })),
    });

    return {
      class: {
        ...toSummary(assignment),
        studentCount: students.length,
      },
      stats: this.buildStats(students, offerings.length),
      subjects: subjects.map((s) => ({
        subjectOfferingId: s.subjectOfferingId,
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        studentsWithMarks: s.studentsWithMarks,
        averagePercentage: s.averagePercentage,
        highestMarks: s.highestMarks,
        highestScorerName: s.highestScorerName,
        highestScorerRollNo: s.highestScorerRollNo,
        passCount: s.passCount,
      })),
      students: students.map((s) => ({
        id: s.id,
        rollNo: s.rollNo,
        name: s.name,
        currentYear: s.currentYear,
        semester: s.semester,
        totalMarks: s.totalMarks,
        maxTotalMarks: s.maxTotalMarks,
        percentage: s.percentage,
        subjectsWithMarks: s.subjectsWithMarks,
        missingSubjects: s.missingSubjects,
        failedSubjects: s.failedSubjects,
      })),
    };
  }

  /**
   * The headline numbers of the class.
   *
   * The pass/fail split is decided per student, not per subject: a student
   * who failed two subjects is one failing student, not two. Summing the
   * per-subject failure counts would count that student twice and could
   * report more failures than the class has students.
   *
   * A student with no marks at all is neither passed nor failed — they are
   * counted under `studentsWithoutAnyMarks`, so the two figures never
   * quietly double-count each other.
   */
  private buildStats(
    students: Array<{
      percentage: number;
      subjectsWithMarks: number;
      missingSubjects: string[];
      failedSubjects: string[];
    }>,
    subjectCount: number
  ): ClassStats {
    const withMarks = students.filter((s) => s.subjectsWithMarks > 0);
    const withoutAnyMarks = students.filter((s) => s.subjectsWithMarks === 0);

    const percentages = withMarks.map((s) => s.percentage);
    const averagePercentage = percentages.length
      ? percentages.reduce((sum, p) => sum + p, 0) / percentages.length
      : 0;

    /**
     * A student passes when they cleared every subject they were marked in.
     * A student who has no marks at all has not failed anything, so they are
     * excluded from the failed count too.
     */
    const failedCount = withMarks.filter((s) => s.failedSubjects.length > 0).length;
    const passedCount = withMarks.length - failedCount;

    const studentsWithFullMarks = students.filter(
      (s) => subjectCount > 0 && s.subjectsWithMarks === subjectCount
    ).length;

    const studentsWithMissingMarks = students.filter(
      (s) => s.subjectsWithMarks < subjectCount
    ).length;

    return {
      studentCount: students.length,
      subjectCount,
      averagePercentage: round(averagePercentage),
      highestPercentage: percentages.length ? Math.max(...percentages) : 0,
      lowestPercentage: percentages.length ? Math.min(...percentages) : 0,
      studentsWithFullMarks,
      studentsWithoutAnyMarks: withoutAnyMarks.length,
      studentsWithMissingMarks,
      passedCount,
      failedCount,
    };
  }

  /**
   * How many students are in a class.
   *
   * The count is taken with the same filters the roster uses, so the number
   * on the class list is the number the class page will show.
   */
  private async countStudents(assignment: MyClassAssignment): Promise<number> {
    const students = await this.repository.findClassStudentsWithMarks({
      branchId: assignment.branchId,
      semester: assignment.semester,
      schemeId: assignment.schemeId,
      academicYearId: assignment.academicYearId,
      offerings: [],
    });
    return students.length;
  }
}

/** Flattens an assignment into the shape the client reads. */
function toSummary(assignment: MyClassAssignment): Omit<MyClassSummary, 'studentCount'> {
  return {
    id: assignment.id,
    branchId: assignment.branchId,
    branchCode: assignment.branchCode,
    branchName: assignment.branchName,
    semester: assignment.semester,
    schemeId: assignment.schemeId,
    schemeName: assignment.schemeName,
    academicYearId: assignment.academicYearId,
    academicYearLabel: assignment.academicYearLabel,
  };
}

/** Rounds to two decimals, so a percentage never shows a repeating tail. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
