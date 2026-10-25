import {
  Body, Controller, Get, NotFoundException, Param, Post,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OcrService } from './ocr.service';
import { StorageService } from '../storage/storage.service';
import { OcrRequestDto } from './dto';
import { Roles, Permissions } from '@/common/decorators';

@ApiTags('OCR')
@ApiBearerAuth()
@Controller('ocr')
export class OcrController {
  constructor(
    private readonly service: OcrService,
    private readonly storage: StorageService,
    @InjectQueue('ocr-jobs') private readonly ocrQueue: Queue,
  ) {}

  @Post('extract')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('upload:process')
  @ApiOperation({
    summary:
      'Trigger OCR extraction against a presigned file URL using HF Inference',
  })
  async extract(@Body() dto: OcrRequestDto) {
    const model =
      dto.modelHint === 'text'
        ? this.service.model('TROCR_HANDWRITTEN')
        : this.service.model('TABLE_TRANSFORMER');

    /**
     * A file the backend stored itself is read straight from disk: the
     * `/files` route it was published under is JWT-guarded, so fetching it
     * over HTTP would fail with a 401. Files that live somewhere else (an
     * external bucket) are still fetched over HTTP.
     */
    let buffer = await this.storage.readByUrl(dto.fileUrl);
    if (!buffer) {
      const resp = await fetch(dto.fileUrl);
      if (!resp.ok) {
        throw new Error(
          `Could not download ${dto.fileUrl}: ${resp.status} ${resp.statusText}`,
        );
      }
      buffer = Buffer.from(await resp.arrayBuffer());
    }

    /**
     * There is no upload job for a standalone extraction, so no job id is
     * passed — the service skips the job-row updates and returns the
     * extracted payload directly.
     */
    return this.service.processImage(null, buffer, model);
  }

  @Post('process/:jobId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('upload:process')
  @ApiOperation({ summary: 'Re-run OCR for an existing upload job (admin)' })
  async process(@Param('jobId') jobId: string) {
    const job = await this.service.getJobStatus(jobId);
    if (!job) throw new NotFoundException('Upload job not found');

    /**
     * The job is queued again rather than processed inline: the OCR call
     * talks to a remote model and can take a while, so it must not block
     * the HTTP request. The worker writes the result back onto the job row.
     */
    await this.ocrQueue.add(
      'process',
      { jobId, fileUrl: (job as { fileUrl?: string }).fileUrl ?? '' },
      { removeOnComplete: true, removeOnFail: 100 },
    );

    return { jobId, current: job, queued: true };
  }

  @Get('jobs/:jobId/status')
  @Permissions('upload:read')
  @ApiOperation({ summary: 'Get the latest OCR status for a job' })
  async status(@Param('jobId') jobId: string) {
    return this.service.getJobStatus(jobId);
  }
}
