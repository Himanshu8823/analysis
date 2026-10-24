import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { PrismaClient } from '@prisma/client';
import type { OcrProcessResult } from './ocr.service';

interface OcrJobData {
  jobId: string;
  fileUrl: string;
}

/**
 * Worker for the `ocr-jobs` queue. Downloads the file from storage, picks the
 * right Hugging Face model, and pushes the extracted payload back onto the
 * UploadJob row.
 */
@Processor('ocr-jobs')
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    private readonly ocrService: OcrService,
    private readonly prisma: PrismaClient,
  ) {
    super();
  }

  async process(job: Job<OcrJobData>): Promise<OcrProcessResult> {
    const { jobId, fileUrl } = job.data;
    this.logger.log(`Processing OCR job ${jobId} for ${fileUrl}`);

    const buffer = await this.downloadFile(fileUrl);
    const model = await this.ocrService.selectModel(true, false);

    return this.ocrService.processImage(jobId, buffer, model);
  }

  private async downloadFile(fileUrl: string): Promise<Buffer> {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download ${fileUrl} (status=${response.status})`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
