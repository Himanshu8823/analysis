import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto';

interface ReportJobData {
  reportId: string;
  dto: CreateReportDto;
  generatedBy: string;
}

/**
 * BullMQ worker for `reports-jobs`. Generates the Excel workbook via the
 * ReportsService (which itself invokes the Excel generator + calculator
 * factory) and persists the file metadata back on the Report row.
 */
@Processor('reports-jobs')
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name);

  constructor(private readonly reportsService: ReportsService) {
    super();
  }

  async process(job: Job<ReportJobData>): Promise<{ reportId: string; status: string }> {
    const { reportId, dto } = job.data;
    this.logger.log(`Generating report ${reportId}`);
    await this.reportsService.runReportGeneration(reportId, dto);
    return { reportId, status: 'COMPLETED' };
  }
}
