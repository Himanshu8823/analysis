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
        studentId_subjectId_examType_academicYearId: {
          studentId: data.studentId,
          subjectId: data.subjectId,
          examType: data.examType,
          academicYearId: data.academicYearId,
        },
      },
      create: {
        studentId: data.studentId,
        subjectId: data.subjectId,
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
          studentId_subjectId_examType_academicYearId: {
            studentId: m.studentId,
            subjectId: m.subjectId,
            examType: m.examType,
            academicYearId: m.academicYearId,
          },
        },
        create: {
          studentId: m.studentId,
          subjectId: m.subjectId,
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
      }),
    );
    return Promise.all(operations);
  }

  async findAll(params: {
    studentId?: string;
    subjectId?: string;
    examType?: string;
    academicYearId?: string;
  }) {
    const where: Prisma.MarkWhereInput = {};
    if (params.studentId) where.studentId = params.studentId;
    if (params.subjectId) where.subjectId = params.subjectId;
    if (params.examType) where.examType = params.examType;
    if (params.academicYearId) where.academicYearId = params.academicYearId;

    return this.prisma.mark.findMany({
      where,
      include: {
        student: { select: { id: true, rollNo: true, name: true } },
        subject: { select: { id: true, code: true, name: true, credits: true } },
      },
      orderBy: [{ studentId: 'asc' }, { subjectId: 'asc' }],
    });
  }

  async findById(id: string): Promise<Mark | null> {
    return this.prisma.mark.findUnique({ where: { id } });
  }

  /**
   * Returns the student's marks for an academic year, with the related subject
   * included — the calculators need `subject.components` to split a total into
   * its exam components.
   */
  async findByStudentAndYear(
    studentId: string,
    academicYearId: string,
  ): Promise<Array<Mark & { subject: Subject }>> {
    return this.prisma.mark.findMany({
      where: { studentId, academicYearId },
      include: { subject: true },
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