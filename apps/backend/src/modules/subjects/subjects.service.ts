import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { SubjectsRepository, type SubjectWithOfferings } from './subjects.repository';
import { CreateSubjectDto, UpdateSubjectDto, CreateSubjectOfferingDto } from './dto';
import type { Subject, SubjectOffering } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class SubjectsService {
  constructor(
    private readonly repository: SubjectsRepository,
    private readonly prisma: PrismaClient
  ) {}

  /**
   * Creates a subject.
   *
   * A duplicate code is rejected with a clear message rather than a raw
   * database error — the code is what every teacher types when entering
   * marks, so it has to be unique and the conflict has to be legible.
   */
  async create(dto: CreateSubjectDto): Promise<Subject> {
    const existing = await this.prisma.subject.findUnique({
      where: { code: dto.code },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`A subject with code "${dto.code}" already exists`);
    }
    return this.repository.create(dto);
  }

  async findAll(params: {
    branchId?: string;
    schemeId?: string;
    semester?: number;
    academicYearId?: string;
    isActive?: boolean;
  }): Promise<SubjectWithOfferings[]> {
    return this.repository.findAll(params);
  }

  async findById(id: string): Promise<SubjectWithOfferings> {
    const subject = await this.repository.findById(id);
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<Subject> {
    await this.findById(id);
    return this.repository.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    return this.repository.delete(id);
  }

  // ---------------------------------------------------------------------
  // Subject offerings
  // ---------------------------------------------------------------------

  /**
   * Offers a subject in a branch + semester + scheme.
   *
   * Both halves are checked before the write: the subject has to exist, and
   * the same subject cannot be offered twice in the same branch/semester/scheme
   * — that pairing is the unique key, and a duplicate would silently split the
   * marks of one class across two rows.
   */
  async createOffering(dto: CreateSubjectOfferingDto): Promise<SubjectOffering> {
    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
      select: { id: true },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    const duplicate = await this.prisma.subjectOffering.findFirst({
      where: {
        subjectId: dto.subjectId,
        branchId: dto.branchId,
        semester: dto.semester,
        schemeId: dto.schemeId,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'This subject is already offered in that branch, semester and scheme'
      );
    }

    return this.repository.createOffering(dto);
  }

  async findOfferings(params: {
    subjectId?: string;
    branchId?: string;
    schemeId?: string;
    academicYearId?: string;
    semester?: number;
    isActive?: boolean;
  }): Promise<SubjectOffering[]> {
    return this.repository.findOfferings(params);
  }

  async findOfferingById(id: string): Promise<SubjectOffering> {
    const offering = await this.repository.findOfferingById(id);
    if (!offering) throw new NotFoundException('Subject offering not found');
    return offering;
  }

  async updateOffering(
    id: string,
    dto: Partial<CreateSubjectOfferingDto>
  ): Promise<SubjectOffering> {
    await this.findOfferingById(id);
    return this.repository.updateOffering(id, dto);
  }

  async deleteOffering(id: string): Promise<void> {
    await this.findOfferingById(id);
    return this.repository.deleteOffering(id);
  }
}
