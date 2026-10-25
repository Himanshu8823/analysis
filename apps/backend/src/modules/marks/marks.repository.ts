import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Mark, Prisma, Subject } from '@prisma/client';
import { CreateMarkDto, BulkCreateMarksDto, UpdateMarkDto } from './dto';

@Injectable()
export class MarksRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateMarkDto, createdBy: string): Promise<Mark> {
    return this.prisma.mark.upsert({
      where: {
        studentId_subjectOfferingId_examType_academicYearId: {
          studentId: data.studentId,
          subjectOfferingId: data.subjectOfferingId,
          examType: data.examType,
          academicYearId: data.academicYearId,
        },
      },
      create: {
        studentId: data.studentId,
        subjectOfferingId: data.subjectOfferingId,
        examType: data.examType,
        marksObtained: data.marksObtained,
        maxMarks: data.maxMarks,
        isAbsent: data.isAbsent ?? false,
        isWithheld: data.isWithheld ?? false,
        academicYearId: data.academicYearId,
        remarks: data.remarks,
        createdBy,
      },
      update: {
        marksObtained: data.marksObtained,
        maxMarks: data.maxMarks,
        isAbsent: data.isAbsent ?? false,
        isWithheld: data.isWithheld ?? false,
        remarks: data.remarks,
      },
    });
  }

  async createBulk(data: BulkCreateMarksDto, createdBy: string): Promise<Mark[]> {
    const operations = data.marks.map((m) =>
      this.prisma.mark.upsert({
        where: {
          studentId_subjectOfferingId_examType_academicYearId: {
            studentId: m.studentId,
            subjectOfferingId: m.subjectOfferingId,
            examType: m.examType,
            academicYearId: m.academicYearId,
          },
        },
        create: {
          studentId: m.studentId,
          subjectOfferingId: m.subjectOfferingId,
          examType: m.examType,
          marksObtained: m.marksObtained,
          maxMarks: m.maxMarks,
          isAbsent: m.isAbsent ?? false,
          isWithheld: m.isWithheld ?? false,
          academicYearId: m.academicYearId,
          remarks: m.remarks,
          createdBy,
        },
        update: {
          marksObtained: m.marksObtained,
          maxMarks: m.maxMarks,
          isAbsent: m.isAbsent ?? false,
          isWithheld: m.isWithheld ?? false,
          remarks: m.remarks,
        },
      })
    );
    return Promise.all(operations);
  }

  async findAll(params: {
    studentId?: string;
    subjectOfferingId?: string;
    subjectId?: string;
    examType?: string;
    academicYearId?: string;
    branchId?: string | string[];
  }) {
    const where: Prisma.MarkWhereInput = {};
    if (params.studentId) where.studentId = params.studentId;
    if (params.subjectOfferingId) where.subjectOfferingId = params.subjectOfferingId;
    if (params.subjectId) where.subjectOffering = { subjectId: params.subjectId };
    if (params.examType) where.examType = params.examType;
    if (params.academicYearId) where.academicYearId = params.academicYearId;
    // A mark carries no branch of its own — the branch lives on the student,
    // so the branch filter has to go through the relation. The scope may name
    // one branch or a set of them, so the filter accepts either.
    if (params.branchId) {
      where.student = {
        branchId: Array.isArray(params.branchId) ? { in: params.branchId } : params.branchId,
      };
    }

    return this.prisma.mark.findMany({
      where,
      include: {
        student: { select: { id: true, rollNo: true, name: true } },
        subjectOffering: {
          select: {
            id: true,
            semester: true,
            subject: { select: { id: true, code: true, name: true, credits: true } },
          },
        },
      },
      orderBy: [{ studentId: 'asc' }, { subjectOfferingId: 'asc' }],
    });
  }

  async findById(id: string): Promise<Mark | null> {
    return this.prisma.mark.findUnique({ where: { id } });
  }

  /**
   * The branch of the student a mark belongs to.
   *
   * A mark has no branch of its own, so the scope check has to go through
   * the student. `null` means the mark does not exist.
   */
  async findStudentBranchId(markId: string): Promise<string | null> {
    const mark = await this.prisma.mark.findUnique({
      where: { id: markId },
      select: { student: { select: { branchId: true } } },
    });
    return mark?.student.branchId ?? null;
  }

  /**
   * Returns the student's marks for an academic year with the subject behind
   * each offering included — the calculators need `subject.components` to
   * split a total into its exam components.
   */
  async findByStudentAndYear(
    studentId: string,
    academicYearId: string
  ): Promise<Array<Mark & { subjectOffering: { subject: Subject } }>> {
    return this.prisma.mark.findMany({
      where: { studentId, academicYearId },
      include: { subjectOffering: { include: { subject: true } } },
    });
  }

  async update(id: string, data: UpdateMarkDto, updatedBy: string): Promise<Mark> {
    return this.prisma.mark.update({
      where: { id },
      data: {
        ...(data.marksObtained !== undefined ? { marksObtained: data.marksObtained } : {}),
        ...(data.maxMarks !== undefined ? { maxMarks: data.maxMarks } : {}),
        ...(data.isAbsent !== undefined ? { isAbsent: data.isAbsent } : {}),
        ...(data.isWithheld !== undefined ? { isWithheld: data.isWithheld } : {}),
        ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),
        updatedBy,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.mark.delete({ where: { id } });
  }
}
