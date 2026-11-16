import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma, TeacherSubject, ClassTeacherAssignment } from '@prisma/client';

/**
 * A teacher allocation, flattened for the list view.
 *
 * The offering already carries the branch, semester and scheme, so the
 * response repeats them as flat fields — a list view never has to join the
 * offering back.
 */
export interface TeacherAllocationRow {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectOfferingId: string;
  semester: number;
  branchId: string;
  academicYearId: string;
}

/**
 * A class that has no class teacher.
 *
 * This is a real state, not an absence of a row: when a teacher is revoked,
 * their class loses its teacher, and the college must be able to see that
 * the class is unassigned rather than infer it from a missing line in a
 * list.
 */
export interface ClassNeedingTeacherRow {
  branchId: string;
  branchName: string;
  semester: number;
  schemeId: string;
  schemeName: string;
  academicYearId: string;
  /** How many students are in the class — a class with nobody in it needs no teacher. */
  studentCount: number;
  /** How many subjects the class is taught. */
  subjectCount: number;
}

/**
 * A class-teacher assignment, flattened for the list view.
 */
export interface ClassTeacherAssignmentRow {
  id: string;
  branchId: string;
  semester: number;
  schemeId: string;
  academicYearId: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  assignedAt: string;
}

/**
 * A teacher who may be allocated a subject in a branch.
 *
 * Only what the allocation screen needs is returned — the member's name and
 * email — so the endpoint can stay narrower than the full member list.
 */
export interface AssignableTeacher {
  id: string;
  name: string;
  email: string;
}

@Injectable()
export class AllocationsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * The teachers who may be allocated a subject in a branch.
   *
   * A teacher is assignable when they hold the TEACHER role in that branch
   * — or in no branch at all, since a college-wide teacher teaches wherever
   * they are needed. Inactive accounts are excluded: a deactivated teacher
   * cannot be given new work.
   *
   * The branch filter is applied on the `UserRole` relation, because the
   * `User` table carries no branch of its own.
   *
   * `branchIds` is a *set*, not a single id. A caller scoped to several
   * branches must see the teachers of all of them and no others, so the
   * filter has to be able to say "one of these". `undefined` means
   * college-wide — no filter at all.
   */
  async findAssignableTeachers(branchIds?: string[]): Promise<AssignableTeacher[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        isActive: true,
        userRoles: {
          some: {
            role: { name: 'TEACHER' },
            ...(branchIds
              ? {
                  OR: [{ branchId: { in: branchIds } }, { branchId: null }],
                }
              : {}),
          },
        },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
      take: 500,
    });

    return rows;
  }

  async findTeacherAllocations(params: {
    branchIds?: string[];
    semester?: number;
    academicYearId?: string;
    teacherId?: string;
    subjectOfferingId?: string;
  }): Promise<TeacherAllocationRow[]> {
    const where: Prisma.TeacherSubjectWhereInput = {};
    if (params.academicYearId) where.academicYearId = params.academicYearId;
    if (params.teacherId) where.teacherId = params.teacherId;
    if (params.subjectOfferingId) where.subjectOfferingId = params.subjectOfferingId;

    const offeringFilter: Prisma.SubjectOfferingWhereInput = {};
    if (params.branchIds) offeringFilter.branchId = { in: params.branchIds };
    if (params.semester !== undefined) offeringFilter.semester = params.semester;
    if (Object.keys(offeringFilter).length > 0) {
      where.subjectOffering = offeringFilter;
    }

    const rows = await this.prisma.teacherSubject.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        subjectOffering: {
          select: {
            id: true,
            branchId: true,
            semester: true,
            academicYearId: true,
            subject: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: [{ teacher: { name: 'asc' } }, { subjectOffering: { id: 'asc' } }],
    });

    return rows.map((r) => ({
      id: r.id,
      teacherId: r.teacherId,
      teacherName: r.teacher.name,
      teacherEmail: r.teacher.email,
      subjectId: r.subjectOffering.subject.id,
      subjectCode: r.subjectOffering.subject.code,
      subjectName: r.subjectOffering.subject.name,
      subjectOfferingId: r.subjectOfferingId,
      semester: r.subjectOffering.semester,
      branchId: r.subjectOffering.branchId,
      academicYearId: r.academicYearId,
    }));
  }

  async findTeacherAllocationById(id: string): Promise<TeacherSubject | null> {
    return this.prisma.teacherSubject.findUnique({ where: { id } });
  }

  async createTeacherAllocation(data: {
    teacherId: string;
    subjectOfferingId: string;
    academicYearId: string;
  }): Promise<TeacherSubject> {
    return this.prisma.teacherSubject.create({
      data: {
        teacherId: data.teacherId,
        subjectOfferingId: data.subjectOfferingId,
        academicYearId: data.academicYearId,
      },
    });
  }

  async deleteTeacherAllocation(id: string): Promise<void> {
    await this.prisma.teacherSubject.delete({ where: { id } });
  }

  async findClassTeacherAssignments(params: {
    branchIds?: string[];
    semester?: number;
    academicYearId?: string;
    teacherId?: string;
  }): Promise<ClassTeacherAssignmentRow[]> {
    const where: Prisma.ClassTeacherAssignmentWhereInput = {};
    if (params.branchIds) where.branchId = { in: params.branchIds };
    if (params.semester !== undefined) where.semester = params.semester;
    if (params.academicYearId) where.academicYearId = params.academicYearId;
    if (params.teacherId) where.teacherId = params.teacherId;

    const rows = await this.prisma.classTeacherAssignment.findMany({
      where,
      include: { teacher: { select: { id: true, name: true, email: true } } },
      orderBy: [{ branchId: 'asc' }, { semester: 'asc' }],
    });

    return rows.map((r) => ({
      id: r.id,
      branchId: r.branchId,
      semester: r.semester,
      schemeId: r.schemeId,
      academicYearId: r.academicYearId,
      teacherId: r.teacherId,
      teacherName: r.teacher.name,
      teacherEmail: r.teacher.email,
      assignedAt: r.assignedAt.toISOString(),
    }));
  }

  async findClassTeacherAssignmentById(id: string): Promise<ClassTeacherAssignment | null> {
    return this.prisma.classTeacherAssignment.findUnique({ where: { id } });
  }

  /**
   * The classes that have students but no class teacher.
   *
   * A class is identified by its branch, semester, scheme and academic year
   * — the same four things that make a class-teacher assignment. The list is
   * built from the **classes that exist** (those with students or subjects)
   * and then filtered to the ones with no teacher, so the answer is the
   * classes the college must act on, not every class in the system.
   *
   * A class with no students and no subjects is not listed: there is nobody
   * to teach and nothing to teach.
   */
  async findClassesNeedingTeacher(params: {
    branchIds?: string[];
    semester?: number;
    academicYearId?: string;
  }): Promise<ClassNeedingTeacherRow[]> {
    const offeringWhere: Prisma.SubjectOfferingWhereInput = {
      isActive: true,
      ...(params.branchIds ? { branchId: { in: params.branchIds } } : {}),
      ...(params.semester !== undefined ? { semester: params.semester } : {}),
      ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
    };

    /**
     * The classes that exist. An offering is a class that is actually taught.
     */
    const offerings = await this.prisma.subjectOffering.findMany({
      where: offeringWhere,
      select: {
        branchId: true,
        semester: true,
        schemeId: true,
        academicYearId: true,
        branch: { select: { name: true } },
        scheme: { select: { name: true } },
      },
    });

    /**
     * The assignments that exist. The list of classes needing a teacher is
     * the difference between the two.
     */
    const assignments = await this.prisma.classTeacherAssignment.findMany({
      where: {
        ...(params.branchIds ? { branchId: { in: params.branchIds } } : {}),
        ...(params.semester !== undefined ? { semester: params.semester } : {}),
        ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
      },
      select: { branchId: true, semester: true, schemeId: true, academicYearId: true },
    });

    const assigned = new Set(
      assignments.map((a) => `${a.branchId}|${a.semester}|${a.schemeId}|${a.academicYearId}`)
    );

    /**
     * Group the offerings into classes. A class may be offered several
     * subjects, so the offerings are counted rather than listed.
     */
    const classes = new Map<
      string,
      {
        branchId: string;
        branchName: string;
        semester: number;
        schemeId: string;
        schemeName: string;
        academicYearId: string;
        subjectCount: number;
      }
    >();

    for (const offering of offerings) {
      /**
       * An offering with no academic year belongs to no class context — the
       * class-teacher assignment is made for a year, so it cannot be one.
       */
      if (!offering.academicYearId) continue;

      const key = `${offering.branchId}|${offering.semester}|${offering.schemeId}|${offering.academicYearId}`;
      if (assigned.has(key)) continue;

      const existing = classes.get(key);
      if (existing) {
        existing.subjectCount += 1;
        continue;
      }

      classes.set(key, {
        branchId: offering.branchId,
        branchName: offering.branch.name,
        semester: offering.semester,
        schemeId: offering.schemeId,
        schemeName: offering.scheme.name,
        academicYearId: offering.academicYearId,
        subjectCount: 1,
      });
    }

    if (classes.size === 0) return [];

    /**
     * How many students are in each class. A class with no students does not
     * need a class teacher — there is nobody to look after.
     */
    const students = await this.prisma.student.findMany({
      where: {
        isActive: true,
        ...(params.branchIds ? { branchId: { in: params.branchIds } } : {}),
        ...(params.semester !== undefined ? { semester: params.semester } : {}),
        ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
      },
      select: { branchId: true, semester: true, schemeId: true, academicYearId: true },
    });

    const studentCounts = new Map<string, number>();
    for (const student of students) {
      const key = `${student.branchId}|${student.semester}|${student.schemeId}|${student.academicYearId}`;
      studentCounts.set(key, (studentCounts.get(key) ?? 0) + 1);
    }

    return Array.from(classes.entries())
      .map(([key, row]) => ({
        ...row,
        studentCount: studentCounts.get(key) ?? 0,
      }))
      .filter((row) => row.studentCount > 0)
      .sort(
        (a, b) =>
          a.branchName.localeCompare(b.branchName) ||
          a.semester - b.semester ||
          a.schemeName.localeCompare(b.schemeName)
      );
  }

  async createClassTeacherAssignment(data: {
    teacherId: string;
    branchId: string;
    semester: number;
    schemeId: string;
    academicYearId: string;
    assignedBy: string;
  }): Promise<ClassTeacherAssignment> {
    return this.prisma.classTeacherAssignment.create({
      data: {
        teacherId: data.teacherId,
        branchId: data.branchId,
        semester: data.semester,
        schemeId: data.schemeId,
        academicYearId: data.academicYearId,
        assignedBy: data.assignedBy,
      },
    });
  }

  async deleteClassTeacherAssignment(id: string): Promise<void> {
    await this.prisma.classTeacherAssignment.delete({ where: { id } });
  }
}
