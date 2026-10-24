import {
  BadRequestException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ReportsRepository } from './reports.repository';
import { ExcelReportGenerator } from './generators/excel.generator';
import { CreateReportDto } from './dto';
import { PrismaClient } from '@prisma/client';
import type { Report } from '@prisma/client';

export const REPORT_QUEUE_NAME = 'reports-jobs';

export interface ReportFilters {
  branchId?: string;
  schemeId?: string;
  semester?: number;
  academicYearId?: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly repository: ReportsRepository,
    private readonly excelGenerator: ExcelReportGenerator,
    private readonly prisma: PrismaClient,
    @InjectQueue(REPORT_QUEUE_NAME) private readonly reportQueue: Queue,
  ) {}

  /**
   * Create a report job. For COMPLETE it goes through the queue (slow); other
   * types are streamed back synchronously to make the dev workflow snappy.
   */
  async create(dto: CreateReportDto, generatedBy: string): Promise<Report> {
    const report = await this.repository.create(dto, generatedBy);
    try {
      await this.reportQueue.add(
        'generate',
        { reportId: report.id, dto, generatedBy },
        { removeOnComplete: 50, removeOnFail: 100 },
      );
    } catch (err) {
      this.logger.warn(
        `BullMQ dispatch failed for report ${report.id}; running inline: ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.runReportGeneration(report.id, dto).catch(() => {
        /* error already recorded in DB */
      });
    }
    return report;
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    generatedBy?: string;
    type?: string;
  }) {
    return this.repository.findAll(params);
  }

  async findById(id: string): Promise<Report> {
    const report = await this.repository.findById(id);
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async updateStatus(
    id: string,
    update: { status?: string; fileUrl?: string; errorMessage?: string; completedAt?: Date },
  ): Promise<Report> {
    return this.repository.updateStatus(id, update);
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  /** Generates the file and updates the Report row. Called by the worker too. */
  async runReportGeneration(reportId: string, dto: CreateReportDto): Promise<void> {
    await this.repository.updateStatus(reportId, { status: 'PROCESSING' });
    try {
      const filters = dto.filters as Record<string, unknown>;
      const validated = this.validateFilters(filters);

      const buffer = await this.excelGenerator.generateCompleteReport({
        branchId: validated.branchId,
        schemeId: validated.schemeId,
        semester: validated.semester,
        academicYearId: validated.academicYearId,
      });

      await this.repository.updateStatus(reportId, {
        status: 'COMPLETED',
        completedAt: new Date(),
        fileUrl: `inline:excel:${buffer.byteLength}:${reportId}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      await this.repository.updateStatus(reportId, {
        status: 'FAILED',
        errorMessage: message,
        completedAt: new Date(),
      });
    }
  }

  /** Stream the latest generated file as a Buffer. */
  async download(reportId: string): Promise<{ buffer: Buffer; filename: string }> {
    const report = await this.findById(reportId);
    if (report.status !== 'COMPLETED') {
      throw new BadRequestException(
        `Report is not ready for download (status=${report.status})`,
      );
    }
    const filters = this.validateFilters(
      report.filters as Record<string, unknown>,
    );
    const buffer = await this.excelGenerator.generateCompleteReport({
      branchId: filters.branchId,
      schemeId: filters.schemeId,
      semester: filters.semester,
      academicYearId: filters.academicYearId,
    });
    return {
      buffer,
      filename: `report-${report.type}-${filters.academicYearId}-${filters.semester}.xlsx`,
    };
  }

  private validateFilters(filters: Record<string, unknown>): ReportFilters & {
    branchId: string;
    schemeId: string;
    semester: number;
    academicYearId: string;
  } {
    const branchId = filters.branchId;
    const schemeId = filters.schemeId;
    const semester = filters.semester;
    const academicYearId = filters.academicYearId;

    if (
      typeof branchId !== 'string' ||
      typeof schemeId !== 'string' ||
      typeof academicYearId !== 'string' ||
      typeof semester !== 'number'
    ) {
      throw new BadRequestException(
        'branchId, schemeId, semester (number), academicYearId are required',
      );
    }
    return { branchId, schemeId, semester, academicYearId };
  }
}
