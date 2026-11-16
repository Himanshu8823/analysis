import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { CreateUploadJobDto, ConfirmUploadDto } from './dto';
import {
  AnyPermission,
  Permissions,
  CurrentUser,
  Audited,
  AuditAction,
  AuditResource,
} from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import { Throttle } from '@nestjs/throttler';
import type { JwtPayload } from '@/common/types';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly service: UploadService) {}

  @Post()
  @Permissions('upload:create')
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } }) // 10/hour/user
  @Audited(AuditResource.UPLOAD_JOB, AuditAction.CREATE, {
    resourceIdSource: 'response',
    detailsFromBody: { fileName: 'fileName', fileType: 'fileType' },
  })
  @ApiOperation({
    summary: 'Register an upload and dispatch it to the matching parser/OCR queue',
  })
  async create(@Body() dto: CreateUploadJobDto, @CurrentUser() user: JwtPayload) {
    return this.service.createJob({
      uploadedBy: user.sub,
      fileName: dto.fileName,
      fileType: dto.fileType,
      fileUrl: dto.fileUrl,
      fileSize: dto.fileSize,
      metadata: dto.metadata,
    });
  }

  /**
   * Uploads the file itself and registers the job in one call.
   *
   * This is what the browser uses — it cannot hand the server a `blob:` URL,
   * and a presigned-storage round trip needs a live bucket. The bytes are
   * written to storage here, and the job gets a URL the parser can fetch.
   */
  @Post('file')
  @Permissions('upload:create')
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } }) // 10/hour/user
  @Audited(AuditResource.UPLOAD_JOB, AuditAction.CREATE, {
    resourceIdSource: 'response',
  })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file and register the parsing job' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: JwtPayload) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    return this.service.createJobFromFile(file, user.sub);
  }

  @Get()
  @Permissions('upload:read')
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('uploadedBy') uploadedBy?: string
  ) {
    return this.service.findAll(
      {
        page: parseOptionalInt(page),
        pageSize: parseOptionalInt(pageSize),
        status: parseOptionalString(status),
        uploadedBy: parseOptionalString(uploadedBy),
      },
      user.sub
    );
  }

  @Get('jobs/:jobId')
  @Permissions('upload:read')
  @ApiOperation({ summary: 'Poll the status of an upload job' })
  async status(@Param('jobId') jobId: string, @CurrentUser() user: JwtPayload) {
    return this.service.findByIdForViewer(jobId, user.sub);
  }

  /**
   * Confirms an extraction and writes it to the marks table.
   *
   * Two different rights can land here and they are not the same right:
   *
   *  - `upload:process` — the exam cell's administrative reach. It approves
   *    a whole extraction for the college.
   *  - `upload:process_own_subject` — the teacher's right to write a score
   *    for the subjects the HOD allocated to them, and nothing else (§3.6).
   *
   * The route is guarded on **either** of them, because either is enough to
   * arrive here — and the service then applies the rule that matches the
   * right the caller actually holds.
   *
   * The route used to be guarded on `upload:read`, a permission to *look* at
   * an upload, because the guard could only require every listed permission.
   * A route that writes marks guarded on a read permission is a guard that
   * does not guard the thing it protects.
   */
  @Post('jobs/:jobId/confirm')
  @AnyPermission('upload:process', 'upload:process_own_subject')
  @Audited(AuditResource.UPLOAD_JOB, AuditAction.CONFIRM, {
    resourceIdSource: 'param',
    resourceIdField: 'jobId',
    detailsFromBody: { rowCount: 'rows' },
  })
  @ApiOperation({
    summary: 'Confirm the extracted data and persist it to the marks table',
  })
  async confirm(
    @Param('jobId') jobId: string,
    @Body() body: ConfirmUploadDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.service.confirmExtraction(jobId, body.rows, body.metadata, user.sub);
  }

  @Get('jobs')
  @Permissions('upload:read')
  async listJobs(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string
  ) {
    return this.service.findAll(
      {
        page: parseOptionalInt(page),
        pageSize: parseOptionalInt(pageSize),
        status: parseOptionalString(status),
      },
      user.sub
    );
  }

  @Delete(':id')
  @Permissions('upload:process')
  @Audited(AuditResource.UPLOAD_JOB, AuditAction.DELETE, { resourceIdSource: 'param' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}
