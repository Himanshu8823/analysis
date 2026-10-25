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

@Injectable()
export class AllocationsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findTeacherAllocations(params: {
    branchId?: string;
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
    if (params.branchId) offeringFilter.branchId = params.branchId;
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
    branchId?: string;
    semester?: number;
    academicYearId?: string;
    teacherId?: string;
  }): Promise<ClassTeacherAssignmentRow[]> {
    const where: Prisma.ClassTeacherAssignmentWhereInput = {};
    if (params.branchId) where.branchId = params.branchId;
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
