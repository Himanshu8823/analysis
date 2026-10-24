import {
  Body, Controller, Delete, Get, Param, Post, Query, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto';
import { Roles, Permissions, CurrentUser } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD')
  @Permissions('reports:generate')
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } }) // 5/hr/user
  @ApiOperation({ summary: 'Queue a new report generation job' })
  async create(@Body() dto: CreateReportDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @Permissions('reports:read')
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('generatedBy') generatedBy?: string,
  ) {
    return this.service.findAll({
      page: parseOptionalInt(page),
      pageSize: parseOptionalInt(pageSize),
      status: parseOptionalString(status),
      type: parseOptionalString(type),
      generatedBy: parseOptionalString(generatedBy),
    });
  }

  @Get(':id')
  @Permissions('reports:read')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get(':id/download')
  @Permissions('reports:download')
  @ApiOperation({ summary: 'Download the generated report as an Excel file' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.service.download(id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('reports:generate')
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}
