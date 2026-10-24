import {
  Body, Controller, Delete, Get, Param, Post, Query, UploadedFile, UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import {
  CreateUploadJobDto,
  ConfirmUploadDto,
} from './dto';
import { Roles, Permissions, CurrentUser } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import { Throttle } from '@nestjs/throttler';
import type { JwtPayload } from '@/common/types';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly service: UploadService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('upload:create')
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } }) // 10/hour/user
  @ApiOperation({
    summary:
      'Register an upload and dispatch it to the matching parser/OCR queue',
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
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('upload:create')
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } }) // 10/hour/user
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file and register the parsing job' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    return this.service.createJobFromFile(file, user.sub);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'TEACHER')
  @Permissions('upload:read')
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('uploadedBy') uploadedBy?: string,
  ) {
    return this.service.findAll({
      page: parseOptionalInt(page),
      pageSize: parseOptionalInt(pageSize),
      status: parseOptionalString(status),
      uploadedBy: parseOptionalString(uploadedBy),
    });
  }

  @Get('jobs/:jobId')
  @Permissions('upload:read')
  @ApiOperation({ summary: 'Poll the status of an upload job' })
  async status(@Param('jobId') jobId: string) {
    return this.service.findById(jobId);
  }

  @Post('jobs/:jobId/confirm')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @Permissions('upload:process')
  @ApiOperation({
    summary:
      'Confirm the extracted data and persist it to the marks table',
  })
  async confirm(
    @Param('jobId') jobId: string,
    @Body() body: ConfirmUploadDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.confirmExtraction(
      jobId,
      body.rows,
      body.metadata,
      user.sub,
    );
  }

  @Get('jobs')
  @Permissions('upload:read')
  async listJobs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({
      page: parseOptionalInt(page),
      pageSize: parseOptionalInt(pageSize),
      status: parseOptionalString(status),
    });
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('upload:process')
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}
