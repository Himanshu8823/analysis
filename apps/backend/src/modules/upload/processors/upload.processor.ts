import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { UploadService } from '../upload.service';
import { parseMarksFile } from '../marks-file.parser';

interface UploadJobData {
  jobId: string;
  fileUrl: string;
  fileType: string;
}

/**
 * Worker that extracts mark rows from an uploaded result sheet.
 *
 * The file is fetched from the storage URL, parsed into rows, and the rows are
 * stored on the job under `extractedData.rows`. The job then sits in the
 * `EXTRACTED` state until the user reviews the rows and confirms them — the
 * confirm endpoint is what writes marks to the database.
 */
@Processor('upload-jobs')
export class UploadProcessor extends WorkerHost {
  private readonly logger = new Logger(UploadProcessor.name);

  constructor(private readonly uploadService: UploadService) {
    super();
  }

  async process(job: Job<UploadJobData>): Promise<{ status: string; rows: number }> {
    const { jobId, fileUrl, fileType } = job.data;
    this.logger.log(`Upload job ${jobId} (${fileType}) starting for ${fileUrl}`);

    await this.uploadService.updateStatus(jobId, {
      status: 'PROCESSING',
      progress: 30,
      startedAt: new Date(),
    });

    try {
      const buffer = await this.fetchFile(fileUrl);
      const filename = this.filenameFromUrl(fileUrl);
      const parsed = await parseMarksFile(buffer, filename);

      await this.uploadService.updateStatus(jobId, {
        status: 'EXTRACTED',
        progress: 100,
        extractedData: {
          rows: parsed.rows,
          errors: parsed.errors,
          totalRows: parsed.rows.length,
          errorCount: parsed.errors.length,
        },
        completedAt: new Date(),
      });

      this.logger.log(
        `Upload job ${jobId} extracted ${parsed.rows.length} rows` +
          (parsed.errors.length ? ` with ${parsed.errors.length} row errors` : ''),
      );

      return { status: 'EXTRACTED', rows: parsed.rows.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Upload job ${jobId} failed: ${message}`);
      await this.uploadService.updateStatus(jobId, {
        status: 'FAILED',
        errorMessage: `Extraction failed: ${message}`,
        completedAt: new Date(),
      });
      throw err;
    }
  }

  /** Downloads the uploaded file from the storage URL. */
  private async fetchFile(fileUrl: string): Promise<Buffer> {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Could not fetch the uploaded file (HTTP ${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * The stored file name carries the original extension, which decides
   * whether the parser treats it as CSV or as a spreadsheet.
   */
  private filenameFromUrl(fileUrl: string): string {
    try {
      const { pathname } = new URL(fileUrl);
      const name = pathname.split('/').pop() ?? 'upload';
      return name.includes('.') ? name : `${name}.xlsx`;
    } catch {
      return 'upload.xlsx';
    }
  }
}
