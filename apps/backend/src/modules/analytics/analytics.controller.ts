import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { Permissions, CurrentUser } from '@/common/decorators';
import { ScopeService } from '@/common/services/scope.service';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly service: AnalyticsService,
    private readonly scope: ScopeService
  ) {}

  // `academicYearId` is optional everywhere: when it is omitted the service
  // falls back to the active academic year, so the client never has to know
  // which year happens to be configured.

  @Get('overview')
  @Permissions('analytics:read')
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } }) // 30/min/user
  @ApiOperation({
    summary: 'High-level overview: students, subjects, pass %, avg %',
  })
  async overview(
    @CurrentUser() user: JwtPayload,
    @Query('academicYearId') academicYearId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string
  ) {
    // A branch-scoped user only ever sees their own branch; asking for a
    // different one is rejected, not overridden.
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.getOverview({
      academicYearId: parseOptionalString(academicYearId),
      branchId: effectiveBranchIds,
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    });
  }

  @Get('pass-fail')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Detailed pass/fail breakdown with class buckets' })
  async passFail(
    @CurrentUser() user: JwtPayload,
    @Query('academicYearId') academicYearId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string
  ) {
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.passFail({
      academicYearId: parseOptionalString(academicYearId),
      branchId: effectiveBranchIds,
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    });
  }

  @Get('subjects')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Per-subject statistics + difficulty rating' })
  async subjects(
    @CurrentUser() user: JwtPayload,
    @Query('academicYearId') academicYearId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string
  ) {
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.subjectStats({
      academicYearId: parseOptionalString(academicYearId),
      branchId: effectiveBranchIds,
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    });
  }

  @Get('subject-difficulty')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Per-subject difficulty rating (alias of /subjects)' })
  async subjectDifficulty(
    @CurrentUser() user: JwtPayload,
    @Query('academicYearId') academicYearId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string
  ) {
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.subjectDifficulty({
      academicYearId: parseOptionalString(academicYearId),
      branchId: effectiveBranchIds,
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    });
  }

  @Get('performance-trends')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Year-over-year performance trends' })
  async performanceTrends(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string
  ) {
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.performanceTrends({
      branchId: effectiveBranchIds,
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    });
  }
}
