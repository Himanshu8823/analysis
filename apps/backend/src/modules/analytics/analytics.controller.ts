import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { Roles, Permissions } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  // `academicYearId` is optional everywhere: when it is omitted the service
  // falls back to the active academic year, so the client never has to know
  // which year happens to be configured.

  @Get('overview')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'PRINCIPAL')
  @Permissions('analytics:read')
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } }) // 30/min/user
  @ApiOperation({
    summary: 'High-level overview: students, subjects, pass %, avg %',
  })
  async overview(
    @Query('academicYearId') academicYearId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
  ) {
    return this.service.getOverview({
      academicYearId: parseOptionalString(academicYearId),
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    });
  }

  @Get('pass-fail')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'PRINCIPAL')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Detailed pass/fail breakdown with class buckets' })
  async passFail(
    @Query('academicYearId') academicYearId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
  ) {
    return this.service.passFail({
      academicYearId: parseOptionalString(academicYearId),
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    });
  }

  @Get('subjects')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'PRINCIPAL', 'TEACHER')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Per-subject statistics + difficulty rating' })
  async subjects(
    @Query('academicYearId') academicYearId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
  ) {
    return this.service.subjectStats({
      academicYearId: parseOptionalString(academicYearId),
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    });
  }

  @Get('subject-difficulty')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'TEACHER')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Per-subject difficulty rating (alias of /subjects)' })
  async subjectDifficulty(
    @Query('academicYearId') academicYearId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
  ) {
    return this.service.subjectDifficulty({
      academicYearId: parseOptionalString(academicYearId),
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    });
  }

  @Get('performance-trends')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'PRINCIPAL')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Year-over-year performance trends' })
  async performanceTrends(
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
  ) {
    return this.service.performanceTrends({
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    });
  }
}
