import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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

@Injectable()
export class AcademicService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Lists the academic years, newest first. The active one comes first so the
   * UI can preselect it.
   */
  async findAllYears(): Promise<AcademicYearSummary[]> {
    const years = await this.prisma.academicYear.findMany({
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
    });
    return years.map((y) => ({
      id: y.id,
      year: y.year,
      startDate: y.startDate.toISOString(),
      endDate: y.endDate.toISOString(),
      isActive: y.isActive,
    }));
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
}
