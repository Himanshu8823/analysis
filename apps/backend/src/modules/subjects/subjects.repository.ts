import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma, Subject, SubjectOffering } from '@prisma/client';
import { CreateSubjectDto, UpdateSubjectDto, CreateSubjectOfferingDto } from './dto';

/**
 * Reads a subject together with the places it is offered.
 *
 * The `offerings` count is what tells the exam cell how widely a subject is
 * used — a subject that is only offered in one branch behaves very differently
 * from one that runs across every semester of a scheme.
 */
export type SubjectWithOfferings = Subject & {
  offerings: {
    id: string;
    branchId: string;
    semester: number;
    schemeId: string;
    year: number | null;
    academicYearId: string | null;
    isActive: boolean;
  }[];
  _count: { offerings: number };
};

@Injectable()
export class SubjectsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Creates the subject's identity. The branch/semester/scheme it is taught
   * in is added afterwards through a separate offering record.
   */
  async create(data: CreateSubjectDto): Promise<Subject> {
    return this.prisma.subject.create({
      data: {
        code: data.code,
        name: data.name,
        credits: data.credits,
        maxMarks: data.maxMarks,
        passingMarks: data.passingMarks,
        components: (data.components ?? []) as unknown as Prisma.InputJsonValue,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Lists the subject catalogue.
   *
   * The old filters (`branchId`, `semester`, `schemeId`) used to live on the
   * subject row itself. They now belong to the offering, so those filters are
   * translated into an "offering matches" sub-query: asking for the CSE
   * branch returns the subjects that CSE actually offers, not every subject
   * in the college.
   */
  async findAll(params: {
    branchId?: string;
    schemeId?: string;
    semester?: number;
    academicYearId?: string;
    isActive?: boolean;
  }): Promise<SubjectWithOfferings[]> {
    const where: Prisma.SubjectWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;

    const offeringFilter: Prisma.SubjectOfferingWhereInput = {};
    if (params.branchId) offeringFilter.branchId = params.branchId;
    if (params.schemeId) offeringFilter.schemeId = params.schemeId;
    if (params.semester !== undefined) offeringFilter.semester = params.semester;
    if (params.academicYearId) offeringFilter.academicYearId = params.academicYearId;

    if (Object.keys(offeringFilter).length > 0) {
      where.offerings = { some: offeringFilter };
    }

    return this.prisma.subject.findMany({
      where,
      include: {
        offerings: {
          where: offeringFilter,
          select: {
            id: true,
            branchId: true,
            semester: true,
            schemeId: true,
            year: true,
            academicYearId: true,
            isActive: true,
          },
        },
        _count: { select: { offerings: true } },
      },
      orderBy: [{ code: 'asc' }],
    });
  }

  async findById(id: string): Promise<SubjectWithOfferings | null> {
    return this.prisma.subject.findUnique({
      where: { id },
      include: {
        offerings: {
          select: {
            id: true,
            branchId: true,
            semester: true,
            schemeId: true,
            year: true,
            academicYearId: true,
            isActive: true,
          },
        },
        _count: { select: { offerings: true } },
      },
    });
  }

  async update(id: string, data: UpdateSubjectDto): Promise<Subject> {
    return this.prisma.subject.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.credits !== undefined ? { credits: data.credits } : {}),
        ...(data.maxMarks !== undefined ? { maxMarks: data.maxMarks } : {}),
        ...(data.passingMarks !== undefined ? { passingMarks: data.passingMarks } : {}),
        ...(data.components !== undefined
          ? { components: data.components as unknown as Prisma.InputJsonValue }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  /** Soft-deletes a subject so its history stays intact. */
  async delete(id: string): Promise<void> {
    await this.prisma.subject.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ---------------------------------------------------------------------
  // Subject offerings
  // ---------------------------------------------------------------------

  /**
   * Offers an existing subject in a branch + semester + scheme.
   *
   * The subject row is never touched — the offering is a separate record so
   * the same subject can run in many semesters without duplication.
   */
  async createOffering(data: CreateSubjectOfferingDto): Promise<SubjectOffering> {
    return this.prisma.subjectOffering.create({
      data: {
        subjectId: data.subjectId,
        branchId: data.branchId,
        semester: data.semester,
        schemeId: data.schemeId,
        // The curriculum year (1, 2, 3, 4) is required by the model. A
        // caller that omits it is offering a subject in the first year of
        // the scheme, which is the only case where it can be inferred.
        year: data.year ?? 1,
        academicYearId: data.academicYearId ?? null,
        isActive: true,
      },
    });
  }

  async findOfferings(params: {
    subjectId?: string;
    branchId?: string;
    schemeId?: string;
    academicYearId?: string;
    semester?: number;
    isActive?: boolean;
  }): Promise<SubjectOffering[]> {
    const where: Prisma.SubjectOfferingWhereInput = {};
    if (params.subjectId) where.subjectId = params.subjectId;
    if (params.branchId) where.branchId = params.branchId;
    if (params.schemeId) where.schemeId = params.schemeId;
    if (params.academicYearId) where.academicYearId = params.academicYearId;
    if (params.semester !== undefined) where.semester = params.semester;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    return this.prisma.subjectOffering.findMany({
      where,
      include: {
        subject: {
          select: {
            id: true,
            code: true,
            name: true,
            credits: true,
            maxMarks: true,
            passingMarks: true,
          },
        },
        branch: { select: { id: true, code: true, name: true } },
        scheme: { select: { id: true, name: true } },
        academicYear: { select: { id: true, year: true } },
      },
      orderBy: [{ branchId: 'asc' }, { semester: 'asc' }, { subjectId: 'asc' }],
    });
  }

  async findOfferingById(id: string): Promise<SubjectOffering | null> {
    return this.prisma.subjectOffering.findUnique({ where: { id } });
  }

  async updateOffering(
    id: string,
    data: Partial<CreateSubjectOfferingDto>
  ): Promise<SubjectOffering> {
    return this.prisma.subjectOffering.update({
      where: { id },
      data: {
        ...(data.subjectId !== undefined ? { subjectId: data.subjectId } : {}),
        ...(data.branchId !== undefined ? { branchId: data.branchId } : {}),
        ...(data.semester !== undefined ? { semester: data.semester } : {}),
        ...(data.schemeId !== undefined ? { schemeId: data.schemeId } : {}),
        ...(data.year !== undefined ? { year: data.year } : {}),
        ...(data.academicYearId !== undefined ? { academicYearId: data.academicYearId } : {}),
      },
    });
  }

  /** Soft-deletes an offering so marks already entered survive. */
  async deleteOffering(id: string): Promise<void> {
    await this.prisma.subjectOffering.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
