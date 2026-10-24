import {
  Body, Controller, Get, Param, Post,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OcrService } from './ocr.service';
import { OcrRequestDto } from './dto';
import { Roles, Permissions } from '@/common/decorators';

@ApiTags('OCR')
@ApiBearerAuth()
@Controller('ocr')
export class OcrController {
  constructor(private readonly service: OcrService) {}

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
    const resp = await fetch(dto.fileUrl);
    if (!resp.ok) {
      throw new Error(
        `Could not download ${dto.fileUrl}: ${resp.status} ${resp.statusText}`,
      );
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    return this.service.processImage('inline', buffer, model);
  }

  @Post('process/:jobId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('upload:process')
  @ApiOperation({ summary: 'Re-run OCR for an existing upload job (admin)' })
  async process(@Param('jobId') jobId: string) {
    const job = await this.service.getJobStatus(jobId);
    return { jobId, current: job };
  }

  @Get('jobs/:jobId/status')
  @Permissions('upload:read')
  @ApiOperation({ summary: 'Get the latest OCR status for a job' })
  async status(@Param('jobId') jobId: string) {
    return this.service.getJobStatus(jobId);
  }
}
