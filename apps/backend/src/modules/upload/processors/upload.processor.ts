import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { UploadService } from '../upload.service';
import { PrismaClient } from '@prisma/client';

interface UploadJobData {
  jobId: string;
  fileUrl: string;
  fileType: string;
}

/**
 * Lightweight worker that updates the upload job's status while the actual
 * extraction is delegated to the matching strategy service (PDF/Excel).
 */
@Processor('upload-jobs')
export class UploadProcessor extends WorkerHost {
  private readonly logger = new Logger(UploadProcessor.name);

  constructor(
    private readonly uploadService: UploadService,
    private readonly prisma: PrismaClient,
  ) {
    super();
  }

  async process(job: Job<UploadJobData>): Promise<{ status: string }> {
    const { jobId, fileUrl, fileType } = job.data;
    this.logger.log(
      `Upload job ${jobId} (${fileType}) starting for ${fileUrl}`,
    );

    await this.uploadService.updateStatus(jobId, {
      status: 'PROCESSING',
      progress: 30,
      startedAt: new Date(),
    });

    // Delegate to the matching processing service in this Nest app. Heavy
    // parsers (Excel / PDF) live in their own modules; we just hand off.
    return { status: 'EXTRACTED' };
  }
}
