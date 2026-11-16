import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Examination } from '@prisma/client';
import { AuthorisationService } from '@/common/services/authorisation.service';
import { CalculatorFactory } from '@/modules/marks/calculator';

/**
 * The lifecycle of a class's result.
 *
 * The college's cycle ends with *publishing* — the moment a class's marks
 * stop being a working sheet and become the answer the college gives. The
 * model has always carried this lifecycle; what was missing was the act.
 */
export type ExaminationStatus = 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED';

/**
 * An examination as the screens see it.
 */
export interface ExaminationRow {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  semester: number;
  schemeId: string;
  schemeName: string;
  academicYearId: string;
  academicYear: string;
  examDate: string;
  status: ExaminationStatus;
  resultPublishedAt: string | null;
  /** How many students the class has. */
  studentCount: number;
  /** How many of them have a complete result. */
  completeCount: number;
  /** Whether every student's result is in — the condition for publishing. */
  isReady: boolean;
}

/**
 * The examinations module's service.
 *
 * Publishing is the consequential act: it is what makes a result the
 * college's answer. It is therefore gated on two things — the caller may
 * publish, and **every** student's result is actually in. A published
 * result that is missing a student is a wrong answer given with the
 * college's authority behind it, which is worse than an unpublished one.
 */
@Injectable()
export class ExaminationsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authorisation: AuthorisationService,
    private readonly factory: CalculatorFactory
  ) {}

  /**
   * The examinations for a scope.
   *
   * Every examination in the caller's branch scope, with the readiness of
   * each one — how many students have a complete result.
   */
  async findAll(params: {
    branchIds?: string[];
    semester?: number;
    academicYearId?: string;
  }): Promise<ExaminationRow[]> {
    const rows = await this.prisma.examination.findMany({
      where: {
        ...(params.branchIds ? { branchId: { in: params.branchIds } } : {}),
        ...(params.semester !== undefined ? { semester: params.semester } : {}),
        ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
      },
      include: {
        branch: { select: { name: true } },
        scheme: { select: { name: true } },
        academicYear: { select: { year: true } },
      },
      orderBy: [{ examDate: 'desc' }],
    });

    const readiness = await this.readinessFor(rows);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      branchId: row.branchId,
      branchName: row.branch.name,
      semester: row.semester,
      schemeId: row.schemeId,
      schemeName: row.scheme.name,
      academicYearId: row.academicYearId,
      academicYear: row.academicYear.year,
      examDate: row.examDate.toISOString(),
      status: row.status as ExaminationStatus,
      resultPublishedAt: row.resultPublishedAt ? row.resultPublishedAt.toISOString() : null,
      studentCount: readiness.get(row.id)?.studentCount ?? 0,
      completeCount: readiness.get(row.id)?.completeCount ?? 0,
      isReady: readiness.get(row.id)?.isReady ?? false,
    }));
  }

  /**
   * One examination, with its readiness.
   */
  async findById(id: string): Promise<ExaminationRow | null> {
    const row = await this.prisma.examination.findUnique({
      where: { id },
      include: {
        branch: { select: { name: true } },
        scheme: { select: { name: true } },
        academicYear: { select: { year: true } },
      },
    });

    if (!row) return null;

    const readiness = await this.readinessFor([row]);

    return {
      id: row.id,
      name: row.name,
      branchId: row.branchId,
      branchName: row.branch.name,
      semester: row.semester,
      schemeId: row.schemeId,
      schemeName: row.scheme.name,
      academicYearId: row.academicYearId,
      academicYear: row.academicYear.year,
      examDate: row.examDate.toISOString(),
      status: row.status as ExaminationStatus,
      resultPublishedAt: row.resultPublishedAt ? row.resultPublishedAt.toISOString() : null,
      studentCount: readiness.get(row.id)?.studentCount ?? 0,
      completeCount: readiness.get(row.id)?.completeCount ?? 0,
      isReady: readiness.get(row.id)?.isReady ?? false,
    };
  }

  /**
   * Creates an examination for a class.
   *
   * One examination per class context — the unique constraint says so, and
   * the service says so in words rather than letting the database's error
   * reach the member.
   */
  async create(
    data: {
      name: string;
      branchId: string;
      semester: number;
      schemeId: string;
      academicYearId: string;
      examDate: Date;
    },
    createdBy: string
  ): Promise<Examination> {
    /**
     * The examination belongs to a branch, and only the exam cell may open
     * one there.
     */
    await this.authorisation.assertBranchWritable(createdBy, data.branchId, 'examination');

    const existing = await this.prisma.examination.findUnique({
      where: {
        branchId_semester_schemeId_academicYearId: {
          branchId: data.branchId,
          semester: data.semester,
          schemeId: data.schemeId,
          academicYearId: data.academicYearId,
        },
      },
      select: { id: true, name: true },
    });

    if (existing) {
      throw new ConflictException(
        `This class already has an examination: "${existing.name}". Change that one instead.`
      );
    }

    return this.prisma.examination.create({
      data: {
        name: data.name,
        branchId: data.branchId,
        semester: data.semester,
        schemeId: data.schemeId,
        academicYearId: data.academicYearId,
        examDate: data.examDate,
        status: 'PENDING',
      },
    });
  }

  /**
   * Publishes a class's result.
   *
   * The moment a class's marks become the college's answer. Two things are
   * checked:
   *
   *  - the caller may publish in that branch;
   *  - **every** student has a complete result.
   *
   * The second is the important one. A published result with a student
   * missing is a wrong answer given with the college's authority behind it,
   * which is worse than an unpublished one — because an unpublished result
   * announces that it is not ready.
   */
  async publish(id: string, publishedBy: string): Promise<Examination> {
    const examination = await this.prisma.examination.findUnique({
      where: { id },
      select: { id: true, name: true, branchId: true, status: true },
    });

    if (!examination) {
      throw new NotFoundException('That examination no longer exists.');
    }

    if (examination.status === 'PUBLISHED') {
      throw new ConflictException(
        `${examination.name} has already been published. Publish it again only if the marks have changed since.`
      );
    }

    await this.authorisation.assertBranchWritable(publishedBy, examination.branchId, 'examination');

    const readiness = await this.readinessFor([{ id: examination.id } as Examination]);

    const readinessForThis = readiness.get(examination.id);
    if (!readinessForThis?.isReady) {
      const missing = readinessForThis
        ? readinessForThis.studentCount - readinessForThis.completeCount
        : 0;

      throw new BadRequestException(
        `${missing} student${missing === 1 ? '' : 's'} in this class do not have a complete ` +
          'result yet, so it cannot be published. Enter the missing marks first.'
      );
    }

    return this.prisma.examination.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        resultPublishedAt: new Date(),
      },
    });
  }

  /**
   * Returns a published result to being worked on.
   *
   * The reverse of publishing, for the case where a mark was found to be
   * wrong after the result went out. The marks are not changed — the
   * correction is a separate act — but the result stops being the college's
   * answer while it is being fixed.
   */
  async unpublish(id: string, unpublishedBy: string): Promise<Examination> {
    const examination = await this.prisma.examination.findUnique({
      where: { id },
      select: { id: true, name: true, branchId: true, status: true },
    });

    if (!examination) {
      throw new NotFoundException('That examination no longer exists.');
    }

    if (examination.status !== 'PUBLISHED') {
      throw new ConflictException(`${examination.name} is not published.`);
    }

    await this.authorisation.assertBranchWritable(
      unpublishedBy,
      examination.branchId,
      'examination'
    );

    return this.prisma.examination.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        resultPublishedAt: null,
      },
    });
  }

  /**
   * How ready each examination is to be published.
   *
   * The count is of students with a **complete** result — every subject of
   * theirs evaluated. A student who is merely present in the roster is not
   * a result.
   */
  private async readinessFor(
    examinations: Array<Pick<Examination, 'id'>>
  ): Promise<Map<string, { studentCount: number; completeCount: number; isReady: boolean }>> {
    const readiness = new Map<
      string,
      { studentCount: number; completeCount: number; isReady: boolean }
    >();

    if (examinations.length === 0) return readiness;

    const ids = examinations.map((examination) => examination.id);

    const rows = await this.prisma.examination.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        branchId: true,
        semester: true,
        schemeId: true,
        academicYearId: true,
      },
    });

    for (const row of rows) {
      const students = await this.prisma.student.findMany({
        where: {
          branchId: row.branchId,
          semester: row.semester,
          schemeId: row.schemeId,
          academicYearId: row.academicYearId,
          isActive: true,
        },
        select: { id: true },
      });

      const studentIds = students.map((student) => student.id);

      if (studentIds.length === 0) {
        readiness.set(row.id, { studentCount: 0, completeCount: 0, isReady: false });
        continue;
      }

      /**
       * The subjects the class is taught, and the marks entered against
       * them. A student is complete when every subject of theirs has a
       * mark — absent and withheld both count as entered, because the
       * examination happened and the outcome is known.
       */
      const offerings = await this.prisma.subjectOffering.findMany({
        where: {
          branchId: row.branchId,
          semester: row.semester,
          schemeId: row.schemeId,
          isActive: true,
        },
        select: { id: true },
      });

      const offeringIds = offerings.map((offering) => offering.id);

      const marks = await this.prisma.mark.findMany({
        where: {
          studentId: { in: studentIds },
          subjectOfferingId: { in: offeringIds },
          academicYearId: row.academicYearId,
        },
        select: { studentId: true, subjectOfferingId: true },
      });

      /**
       * How many distinct subjects each student has a mark for. The
       * comparison is on the count, so a student who has two components
       * entered for one subject is still counted once.
       */
      const covered = new Map<string, Set<string>>();
      for (const mark of marks) {
        const set = covered.get(mark.studentId) ?? new Set<string>();
        set.add(mark.subjectOfferingId);
        covered.set(mark.studentId, set);
      }

      const completeCount = studentIds.filter(
        (studentId) => (covered.get(studentId)?.size ?? 0) === offeringIds.length
      ).length;

      readiness.set(row.id, {
        studentCount: studentIds.length,
        completeCount,
        isReady: studentIds.length > 0 && completeCount === studentIds.length,
      });
    }

    return readiness;
  }
}
