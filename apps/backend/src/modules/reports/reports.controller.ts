import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReportsService } from './reports.service';
import { ArchiveReportDto, CreateReportDto } from './dto';
import { Permissions, CurrentUser, Audited, AuditAction, AuditResource } from '@/common/decorators';
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
  @Audited(AuditResource.REPORT, AuditAction.CREATE, {
    resourceIdSource: 'response',
    detailsFromBody: { reportType: 'reportType', format: 'format' },
  })
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
    // A branch-scoped user only ever sees reports for their own branches;
    // asking for a different one is rejected, not overridden.
    //
    // The filter is a *set*, not a single id. A user scoped to two
    // branches who names neither still sees those two branches and no
    // others — a single-id scope would drop the filter altogether and
    // show them the whole college.
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.findAll({
      page: parseOptionalInt(page),
      pageSize: parseOptionalInt(pageSize),
      status: parseOptionalString(status),
      type: parseOptionalString(type),
      generatedBy: parseOptionalString(generatedBy),
      branchId: effectiveBranchIds,
    });
  }

  /**
   * Whether a class's result is complete enough to report on.
   *
   * The reports screen calls this before offering the generate button, so
   * the operator is told what is missing *before* they try — rather than
   * only after the request is refused.
   *
   * Declared before `@Get(':id')` so the literal path wins over it.
   */
  @Get('readiness')
  @Permissions('reports:read')
  @ApiOperation({ summary: 'Check whether a class result is complete enough to report on' })
  async readiness(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
    @Query('academicYearId') academicYearId?: string
  ) {
    // The readiness check is about *one* class — one branch, one scheme,
    // one semester. A caller who names no branch has not named a class, so
    // there is nothing to check. That is different from a caller who names
    // a branch they do not own: that is a refusal, not an empty answer.
    //
    // The scope is resolved as a set because a user scoped to two branches
    // who names neither has no class to check, and must not be handed the
    // first branch as though they had asked for it.
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    const requestedBranchId = parseOptionalString(branchId);

    if (!requestedBranchId && effectiveBranchIds && effectiveBranchIds.length > 1) {
      throw new BadRequestException(
        'Name the branch to check. You have access to more than one branch.'
      );
    }

    // A college-scoped caller gets no filter, so it must name a branch.
    if (!requestedBranchId && (!effectiveBranchIds || effectiveBranchIds.length === 0)) {
      throw new BadRequestException(
        'Name the branch, scheme, semester and academic year to check.'
      );
    }

    return this.service.checkReadiness({
      branchId: requestedBranchId ?? effectiveBranchIds?.[0] ?? '',
      schemeId: parseOptionalString(schemeId) ?? '',
      semester: parseOptionalInt(semester) ?? 0,
      academicYearId: parseOptionalString(academicYearId) ?? '',
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
   * only see reports generated for their own branches; the resolution
   * throws when the report's branch is not one of them.
   */
  private async assertReportVisible(userId: string, reportId: string): Promise<void> {
    const branchId = await this.service.findBranchIdOfReport(reportId);
    // A report with no branch filter covers the whole college, so it is
    // visible to everyone.
    if (!branchId) return;

    await this.scope.resolveBranchFilter(userId, branchId);
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

  /**
   * Archives a report.
   *
   * The report is not deleted: the row is kept with the reason it was
   * archived and who archived it, because a report is a statement about a
   * class's results and a result that vanished cannot be accounted for. The
   * file is released.
   *
   * Archiving is not a lesser act than reading. A branch-scoped user who
   * may not see a report may not archive it either — otherwise the scope
   * on the read is theatre, and a report can be removed by someone it
   * was never meant to reach.
   */
  @Delete(':id')
  @Permissions('reports:generate')
  @Audited(AuditResource.REPORT, AuditAction.DELETE, {
    resourceIdSource: 'param',
    detailsFromBody: { reason: 'reason' },
  })
  @ApiOperation({ summary: 'Archive a report' })
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ArchiveReportDto
  ): Promise<void> {
    await this.assertReportVisible(user.sub, id);

    return this.service.archive(id, user.sub, dto.reason);
  }
}
