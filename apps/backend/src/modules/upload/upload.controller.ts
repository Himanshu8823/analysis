import {
  Body, Controller, Delete, Get, Param, Post, Query, UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import {
  CreateUploadJobDto,
  ConfirmUploadDto,
} from './dto';
import { Roles, Permissions, CurrentUser } from '@/common/decorators';
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

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'TEACHER')
  @Permissions('upload:read')
  async findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
    @Query('uploadedBy') uploadedBy?: string,
  ) {
    return this.service.findAll({ page, pageSize, status, uploadedBy });
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
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
  ) {
    return this.service.findAll({ page, pageSize, status });
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('upload:process')
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}
