import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ReportsRepository } from './reports.repository';
import { ExcelReportGenerator } from './generators/excel.generator';
import { ReportReadinessService, type ReadinessScope } from './report-readiness.service';
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
    private readonly readiness: ReportReadinessService,
    private readonly prisma: PrismaClient,
    @InjectQueue(REPORT_QUEUE_NAME) private readonly reportQueue: Queue
  ) {}

  /**
   * Create a report job.
   *
   * The job is refused when the class's result is not complete. A report is
   * a published statement about the class — every student in it gets a
   * PASS or a FAIL on the sheet — so producing one while marks are still
   * missing would publish a verdict for students whose result is not in
   * yet. The refusal names what is missing, so the operator knows what to
   * enter.
   */
  async create(dto: CreateReportDto, generatedBy: string): Promise<Report> {
    const scope = this.readScope(dto.filters);
    const readiness = await this.readiness.check(scope);

    if (!readiness.isReady) {
      throw new BadRequestException({
        message: readiness.message,
        code: 'RESULT_NOT_AVAILABLE',
        readiness: {
          studentCount: readiness.studentCount,
          completeCount: readiness.completeCount,
          pendingCount: readiness.pendingCount,
          pendingSubjects: readiness.pendingSubjects,
          pendingStudents: readiness.pendingStudents,
        },
      });
    }

    const report = await this.repository.create(dto, generatedBy);
    try {
      await this.reportQueue.add(
        'generate',
        { reportId: report.id, dto, generatedBy },
        { removeOnComplete: 50, removeOnFail: 100 }
      );
    } catch (err) {
      this.logger.warn(
        `BullMQ dispatch failed for report ${report.id}; running inline: ${err instanceof Error ? err.message : String(err)}`
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
    /**
     * The branches the read may cover.
     *
     * `undefined` means college-wide — no branch filter at all. A set of
     * one or more narrows the read to those branches. The value is a set
     * rather than a single id because a user may be scoped to several
     * branches at once, and a read that named none must still be narrowed
     * to all of them.
     */
    branchId?: string | string[];
  }) {
    return this.repository.findAll(params);
  }

  async findById(id: string): Promise<Report> {
    const report = await this.repository.findById(id);
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  /**
   * The branch a report was generated for.
   *
   * `null` when the report does not exist or carries no branch filter.
   */
  async findBranchIdOfReport(id: string): Promise<string | null> {
    return this.repository.findBranchIdOfReport(id);
  }

  async updateStatus(
    id: string,
    update: { status?: string; fileUrl?: string; errorMessage?: string; completedAt?: Date }
  ): Promise<Report> {
    return this.repository.updateStatus(id, update);
  }

  /**
   * Archives a report.
   *
   * The report is not deleted. It is a statement about a class's results,
   * and the row is kept with the reason it was archived and who archived it.
   * The file is released; the record is not.
   */
  async archive(id: string, archivedBy: string, reason: string): Promise<void> {
    const report = await this.repository.findById(id);
    if (!report) {
      throw new NotFoundException('This report no longer exists.');
    }
    if (report.isArchived) {
      throw new BadRequestException('This report has already been archived.');
    }

    return this.repository.archive(id, archivedBy, reason);
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

  /**
   * Stream the latest generated file as a Buffer.
   *
   * The file is generated fresh from the marks rather than being served
   * from disk, so it always reflects the current data. That means the
   * readiness check has to run here too: marks may have been added or
   * withdrawn since the report was queued, and a download must never hand
   * out a sheet that states a verdict for a result that is not in.
   */
  async download(reportId: string): Promise<{ buffer: Buffer; filename: string }> {
    const report = await this.findById(reportId);
    if (report.status !== 'COMPLETED') {
      throw new BadRequestException(`Report is not ready for download (status=${report.status})`);
    }
    const filters = this.validateFilters(report.filters as Record<string, unknown>);

    const readiness = await this.readiness.check({
      branchId: filters.branchId,
      schemeId: filters.schemeId,
      semester: filters.semester,
      academicYearId: filters.academicYearId,
    });

    if (!readiness.isReady) {
      throw new BadRequestException({
        message: readiness.message,
        code: 'RESULT_NOT_AVAILABLE',
        readiness: {
          studentCount: readiness.studentCount,
          completeCount: readiness.completeCount,
          pendingCount: readiness.pendingCount,
          pendingSubjects: readiness.pendingSubjects,
          pendingStudents: readiness.pendingStudents,
        },
      });
    }

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
        'branchId, schemeId, semester (number), academicYearId are required'
      );
    }
    return { branchId, schemeId, semester, academicYearId };
  }

  /**
   * Whether a class's result is complete enough to report on.
   *
   * The scope is resolved by the controller before it reaches here, so a
   * branch-scoped caller cannot ask about a class outside their branch.
   */
  async checkReadiness(scope: ReadinessScope) {
    return this.readiness.check(scope);
  }

  /**
   * The scope the readiness check runs against.
   *
   * The filters are validated first, so a request missing them fails with
   * the same message it always has — the readiness check is about the
   * marks, not about the shape of the request.
   */
  private readScope(filters: Record<string, unknown>): ReadinessScope {
    return this.validateFilters(filters);
  }
}
