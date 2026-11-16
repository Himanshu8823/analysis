import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OcrService } from './ocr.service';
import { StorageService } from '../storage/storage.service';
import { OcrRequestDto } from './dto';
import { Permissions, CurrentUser } from '@/common/decorators';
import { ScopeService } from '@/common/services/scope.service';
import { UrlGuardService } from '@/common/services/url-guard.service';
import type { JwtPayload } from '@/common/types';

@ApiTags('OCR')
@ApiBearerAuth()
@Controller('ocr')
export class OcrController {
  constructor(
    private readonly service: OcrService,
    private readonly storage: StorageService,
    private readonly scope: ScopeService,
    private readonly urlGuard: UrlGuardService,
    @InjectQueue('ocr-jobs') private readonly ocrQueue: Queue
  ) {}

  @Post('extract')
  @Permissions('upload:process')
  @ApiOperation({
    summary: 'Trigger OCR extraction against a presigned file URL using HF Inference',
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
     * external bucket) are still fetched over HTTP — but only after the
     * address has been checked, so that a request cannot make the server
     * visit an address only it can reach.
     */
    let buffer = await this.storage.readByUrl(dto.fileUrl);
    if (!buffer) {
      await this.urlGuard.assertFetchable(dto.fileUrl);

      const resp = await fetch(dto.fileUrl);
      if (!resp.ok) {
        throw new Error(`Could not download the file: ${resp.status} ${resp.statusText}`);
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
  @Permissions('upload:process')
  @ApiOperation({ summary: 'Re-run OCR for an existing upload job (admin)' })
  async process(@Param('jobId') jobId: string, @CurrentUser() user: JwtPayload) {
    /**
     * The job carries the marks read out of the file. A member may re-run
     * OCR for a job they raised; a college-wide member may do so for any
     * job.
     */
    const job = await this.service.getJobStatus(
      jobId,
      user.sub,
      await this.readsEveryUpload(user.sub)
    );
    if (!job) throw new NotFoundException('Upload job not found');

    /**
     * The job is queued again rather than processed inline: the OCR call
     * talks to a remote model and can take a while, so it must not block
     * the HTTP request. The worker writes the result back onto the job row.
     */
    await this.ocrQueue.add(
      'process',
      { jobId, fileUrl: (job as { fileUrl?: string }).fileUrl ?? '' },
      { removeOnComplete: true, removeOnFail: 100 }
    );

    return { jobId, current: job, queued: true };
  }

  @Get('jobs/:jobId/status')
  @Permissions('upload:read')
  @ApiOperation({ summary: 'Get the latest OCR status for a job' })
  async status(@Param('jobId') jobId: string, @CurrentUser() user: JwtPayload) {
    /**
     * The job carries the marks read out of the file, so it is read under
     * the same scope as the marks themselves: a member sees the jobs they
     * raised, and a college-wide member sees all of them.
     */
    return this.service.getJobStatus(jobId, user.sub, await this.readsEveryUpload(user.sub));
  }

  /**
   * Whether a member may read every upload job, rather than only the ones
   * they raised.
   *
   * The answer comes from the branch scope: a member whose roles all name
   * no branch works across the whole college and may read every upload; a
   * branch-scoped member may read only their own. This is the same scope
   * the rest of the system uses, so a member sees the same boundary on
   * every screen.
   */
  private async readsEveryUpload(userId: string): Promise<boolean> {
    const branches = await this.scope.branchScope(userId);
    return branches.length === 0;
  }
}
