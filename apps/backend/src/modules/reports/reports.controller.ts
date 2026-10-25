import { Body, Controller, Delete, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto';
import { Permissions, CurrentUser } from '@/common/decorators';
import { ScopeService } from '@/common/services/scope.service';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly scope: ScopeService
  ) {}

  @Post()
  @Permissions('reports:generate')
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } }) // 5/hr/user
  @ApiOperation({ summary: 'Queue a new report generation job' })
  async create(@Body() dto: CreateReportDto, @CurrentUser() user: JwtPayload) {
    // The branch to report on lives in the filters. A branch-scoped user may
    // only generate reports for their own branch.
    const requestedBranchId = dto.filters?.branchId;
    if (typeof requestedBranchId === 'string') {
      const effectiveBranchId = await this.scope.resolveBranchScope(user.sub, requestedBranchId);
      if (effectiveBranchId && effectiveBranchId !== requestedBranchId) {
        dto.filters = { ...dto.filters, branchId: effectiveBranchId };
      }
    }

    return this.service.create(dto, user.sub);
  }

  @Get()
  @Permissions('reports:read')
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('generatedBy') generatedBy?: string,
    @Query('branchId') branchId?: string
  ) {
    // A branch-scoped user only ever sees reports for their own branch;
    // asking for a different one is rejected, not overridden.
    const effectiveBranchId = await this.scope.resolveBranchScope(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.findAll({
      page: parseOptionalInt(page),
      pageSize: parseOptionalInt(pageSize),
      status: parseOptionalString(status),
      type: parseOptionalString(type),
      generatedBy: parseOptionalString(generatedBy),
      branchId: effectiveBranchId,
    });
  }

  @Get(':id')
  @Permissions('reports:read')
  async findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    // A report carries no branch column of its own — the branch lives inside
    // the `filters` JSON, so the scope is checked against that.
    await this.assertReportVisible(user.sub, id);

    return this.service.findById(id);
  }

  /**
   * Rejects the read when the report's branch is outside the caller's scope.
   *
   * A college-scoped caller may see any report. A branch-scoped caller may
   * only see reports generated for their own branch; `resolveBranchScope`
   * throws when the two do not match.
   */
  private async assertReportVisible(userId: string, reportId: string): Promise<void> {
    const branchId = await this.service.findBranchIdOfReport(reportId);
    // A report with no branch filter covers the whole college, so it is
    // visible to everyone.
    if (!branchId) return;

    await this.scope.resolveBranchScope(userId, branchId);
  }

  @Get(':id/download')
  @Permissions('reports:download')
  @ApiOperation({ summary: 'Download the generated report as an Excel file' })
  async download(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Res() res: Response) {
    // The download carries the same data as the read, so it carries the same
    // scope check.
    await this.assertReportVisible(user.sub, id);

    const { buffer, filename } = await this.service.download(id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Delete(':id')
  @Permissions('reports:generate')
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}
