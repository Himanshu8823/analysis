import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { pickRunningYear } from '@/common/utils/academic-year';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';

export interface AcademicYearSummary {
  id: string;
  year: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface BatchSummary {
  id: string;
  name: string;
  admissionYearId: string;
  isActive: boolean;
}

/**
 * One class in the academic structure.
 *
 * A class is branch + semester + scheme + academic year. Everything the
 * college needs to know about it is here: what is taught, who teaches it,
 * who looks after it, how many students are in it, and how ready it is.
 */
export interface AcademicClassRow {
  branchId: string;
  branchName: string;
  branchCode: string;
  semester: number;
  schemeId: string;
  schemeName: string;
  academicYearId: string;
  academicYear: string;
  /** The subjects offered to the class. */
  subjects: Array<{
    subjectOfferingId: string;
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    credits: number;
    /** The teacher allocated to teach it, when there is one. */
    teacherName: string | null;
  }>;
  /** The class teacher, when the class has one. */
  classTeacherName: string | null;
  /** How many students are in the class. */
  studentCount: number;
  /** How many of them have marks against every subject. */
  studentsWithCompleteResult: number;
  /** Whether the class's result could be published. */
  isReadyToPublish: boolean;
}

@Injectable()
export class AcademicService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Lists the academic years, newest first.
   *
   * The **running** year comes first, so the UI can preselect it. "Running"
   * is decided by the dates — the year whose window contains today — and
   * not by the `isActive` flag, which is the college's own label and can
   * contradict the dates.
   *
   * When no year is running — the college is between two years, or has no
   * calendar yet — the order is simply newest first, and the client works
   * out for itself which year to default to.
   */
  async findAllYears(): Promise<AcademicYearSummary[]> {
    const years = await this.prisma.academicYear.findMany({
      orderBy: { startDate: 'desc' },
    });

    const summaries = years.map((y) => ({
      id: y.id,
      year: y.year,
      startDate: y.startDate.toISOString(),
      endDate: y.endDate.toISOString(),
      isActive: y.isActive,
    }));

    const running = pickRunningYear(
      years.map((y) => ({
        id: y.id,
        year: y.year,
        startDate: y.startDate,
        endDate: y.endDate,
        isActive: y.isActive,
      }))
    );

    if (!running) return summaries;

    return [
      ...summaries.filter((s) => s.id === running.id),
      ...summaries.filter((s) => s.id !== running.id),
    ];
  }

  async findYearById(id: string): Promise<AcademicYearSummary | null> {
    const year = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!year) return null;
    return {
      id: year.id,
      year: year.year,
      startDate: year.startDate.toISOString(),
      endDate: year.endDate.toISOString(),
      isActive: year.isActive,
    };
  }

  /**
   * Creates an academic year.
   *
   * A year is named the way the college names it — "2024-25" — and carries
   * the dates it runs between. The dates are not decoration: the system
   * works out which year is running today by comparing today's date against
   * them, so a year whose dates are wrong makes every default in the app
   * wrong.
   *
   * Exactly one year is the running year at a time. Making a year active
   * therefore retires the previous one, in the same transaction — two active
   * years would make "the current year" ambiguous, and every screen that
   * defaults to it would disagree with every other.
   */
  async createYear(dto: CreateAcademicYearDto): Promise<AcademicYearSummary> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Give the dates the year runs between, as YYYY-MM-DD.');
    }
    if (endDate <= startDate) {
      throw new BadRequestException(
        'The year must end after it starts. Check the dates you entered.'
      );
    }

    const existing = await this.prisma.academicYear.findUnique({
      where: { year: dto.year.trim() },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`${dto.year.trim()} is already an academic year.`);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      /**
       * Only one year runs at a time, so making this one active retires the
       * one before it. Doing it in the same transaction means the college
       * never sees a moment with two active years.
       */
      if (dto.isActive) {
        await tx.academicYear.updateMany({ where: { isActive: true }, data: { isActive: false } });
      }

      return tx.academicYear.create({
        data: {
          year: dto.year.trim(),
          startDate,
          endDate,
          isActive: dto.isActive ?? false,
        },
      });
    });

    return {
      id: created.id,
      year: created.year,
      startDate: created.startDate.toISOString(),
      endDate: created.endDate.toISOString(),
      isActive: created.isActive,
    };
  }

  /**
   * Makes one academic year the running year.
   *
   * The previous running year is retired in the same transaction. A year
   * that has marks in it is not touched — the year only says which year is
   * current, and the history of every year is kept.
   */
  async activateYear(id: string): Promise<AcademicYearSummary> {
    const year = await this.prisma.academicYear.findUnique({ where: { id } });
    if (!year) {
      throw new NotFoundException('That academic year no longer exists.');
    }
    if (year.isActive) {
      throw new ConflictException(`${year.year} is already the running academic year.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({ where: { isActive: true }, data: { isActive: false } });
      return tx.academicYear.update({ where: { id }, data: { isActive: true } });
    });

    return {
      id: updated.id,
      year: updated.year,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate.toISOString(),
      isActive: updated.isActive,
    };
  }

  /**
   * Lists the batches. When `admissionYearId` is given only the batches that
   * belong to that admission year are returned.
   */
  async findAllBatches(admissionYearId?: string): Promise<BatchSummary[]> {
    const batches = await this.prisma.batch.findMany({
      where: admissionYearId ? { admissionYearId } : undefined,
      orderBy: { name: 'desc' },
    });
    return batches.map((b) => ({
      id: b.id,
      name: b.name,
      admissionYearId: b.admissionYearId,
      isActive: b.isActive,
    }));
  }

  /**
   * The academic structure — every class, with what is taught to it and how
   * ready it is.
   *
   * This is the screen the college navigates by. It answers, for one class:
   * which subjects are offered, who teaches each, who is the class teacher,
   * how many students are in it, and how many of them still have marks
   * missing.
   *
   * The queries are made **once each** and the rows are assembled in memory.
   * A college has five branches and eight semesters, so the structure is a
   * few hundred rows; asking the database once per row would be slow for
   * no reason.
   */
  async buildStructure(params: {
    branchIds?: string[];
    academicYearId?: string;
    semester?: number;
  }): Promise<{ academicYears: AcademicYearSummary[]; classes: AcademicClassRow[] }> {
    /**
     * The years, as the rows the database holds them. The running year is
     * worked out from those rows, because the resolver compares dates.
     */
    const yearRows = await this.prisma.academicYear.findMany({
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    });

    const academicYears: AcademicYearSummary[] = yearRows.map((year) => ({
      id: year.id,
      year: year.year,
      startDate: year.startDate.toISOString(),
      endDate: year.endDate.toISOString(),
      isActive: year.isActive,
    }));

    /**
     * The year the structure is shown for. The running year is the default,
     * because that is the year the college is working in.
     */
    const yearId = params.academicYearId ?? pickRunningYear(yearRows)?.id ?? yearRows[0]?.id;

    if (!yearId) {
      return { academicYears, classes: [] };
    }

    const offeringWhere = {
      isActive: true,
      ...(params.branchIds ? { branchId: { in: params.branchIds } } : {}),
      ...(params.semester !== undefined ? { semester: params.semester } : {}),
      ...(params.academicYearId || yearId ? { academicYearId: yearId } : {}),
    };

    const [offerings, classTeachers, students, marks] = await Promise.all([
      this.prisma.subjectOffering.findMany({
        where: offeringWhere,
        select: {
          id: true,
          subjectId: true,
          branchId: true,
          semester: true,
          schemeId: true,
          academicYearId: true,
          branch: { select: { name: true, code: true } },
          scheme: { select: { name: true } },
          subject: { select: { code: true, name: true, credits: true } },
          teacherSubjects: {
            where: { academicYearId: yearId },
            select: { teacher: { select: { name: true } } },
            take: 1,
          },
        },
      }),
      this.prisma.classTeacherAssignment.findMany({
        where: {
          ...(params.branchIds ? { branchId: { in: params.branchIds } } : {}),
          ...(params.semester !== undefined ? { semester: params.semester } : {}),
          academicYearId: yearId,
        },
        select: {
          branchId: true,
          semester: true,
          schemeId: true,
          academicYearId: true,
          teacher: { select: { name: true } },
        },
      }),
      this.prisma.student.findMany({
        where: {
          isActive: true,
          ...(params.branchIds ? { branchId: { in: params.branchIds } } : {}),
          ...(params.semester !== undefined ? { semester: params.semester } : {}),
          academicYearId: yearId,
        },
        select: { id: true, branchId: true, semester: true, schemeId: true },
      }),
      this.prisma.mark.findMany({
        where: {
          academicYearId: yearId,
          ...(params.branchIds ? { student: { branchId: { in: params.branchIds } } } : {}),
        },
        select: { studentId: true, subjectOfferingId: true },
      }),
    ]);

    /**
     * The class teacher of each class.
     */
    const teacherByClass = new Map(
      classTeachers.map((assignment) => [
        classKey(
          assignment.branchId,
          assignment.semester,
          assignment.schemeId,
          assignment.academicYearId
        ),
        assignment.teacher.name,
      ])
    );

    /**
     * The students of each class, and how many of them have a mark against
     * every subject.
     */
    const studentsByClass = new Map<string, string[]>();
    for (const student of students) {
      const key = classKey(student.branchId, student.semester, student.schemeId, yearId);
      const list = studentsByClass.get(key) ?? [];
      list.push(student.id);
      studentsByClass.set(key, list);
    }

    const coveredByStudent = new Map<string, Set<string>>();
    for (const mark of marks) {
      const set = coveredByStudent.get(mark.studentId) ?? new Set<string>();
      set.add(mark.subjectOfferingId);
      coveredByStudent.set(mark.studentId, set);
    }

    /**
     * The classes, assembled from the offerings.
     */
    const classes = new Map<string, AcademicClassRow>();

    for (const offering of offerings) {
      const key = classKey(
        offering.branchId,
        offering.semester,
        offering.schemeId,
        offering.academicYearId ?? yearId
      );

      let row = classes.get(key);
      if (!row) {
        row = {
          branchId: offering.branchId,
          branchName: offering.branch.name,
          branchCode: offering.branch.code,
          semester: offering.semester,
          schemeId: offering.schemeId,
          schemeName: offering.scheme.name,
          academicYearId: offering.academicYearId ?? yearId,
          academicYear:
            academicYears.find((year) => year.id === (offering.academicYearId ?? yearId))?.year ??
            '',
          subjects: [],
          classTeacherName: teacherByClass.get(key) ?? null,
          studentCount: 0,
          studentsWithCompleteResult: 0,
          isReadyToPublish: false,
        };
        classes.set(key, row);
      }

      row.subjects.push({
        subjectOfferingId: offering.id,
        subjectId: offering.subjectId,
        subjectCode: offering.subject.code,
        subjectName: offering.subject.name,
        credits: offering.subject.credits,
        teacherName: offering.teacherSubjects[0]?.teacher.name ?? null,
      });
    }

    /**
     * The readiness of each class: how many of its students have a mark
     * against every subject it is taught.
     */
    for (const [key, row] of classes) {
      const classStudents = studentsByClass.get(key) ?? [];
      const subjectCount = row.subjects.length;

      const complete = classStudents.filter((studentId) => {
        const covered = coveredByStudent.get(studentId);
        return (
          subjectCount > 0 &&
          row.subjects.every((subject) => covered?.has(subject.subjectOfferingId))
        );
      }).length;

      row.studentCount = classStudents.length;
      row.studentsWithCompleteResult = complete;
      row.isReadyToPublish = classStudents.length > 0 && complete === classStudents.length;
    }

    return {
      academicYears,
      classes: [...classes.values()].sort(
        (a, b) =>
          a.branchCode.localeCompare(b.branchCode) ||
          a.semester - b.semester ||
          a.schemeName.localeCompare(b.schemeName)
      ),
    };
  }
}

/**
 * The key a class is identified by.
 *
 * A class is branch + semester + scheme + academic year, and the same four
 * things identify a class-teacher assignment and a student's place in a
 * class.
 */
function classKey(
  branchId: string,
  semester: number,
  schemeId: string,
  academicYearId: string
): string {
  return `${branchId}|${semester}|${schemeId}|${academicYearId}`;
}
