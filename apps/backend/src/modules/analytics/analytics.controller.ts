import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { Roles, Permissions } from '@/common/decorators';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('overview')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'PRINCIPAL')
  @Permissions('analytics:read')
  @Throttle({ default: { limit: 30, ttl: 60 * 1000 } }) // 30/min/user
  @ApiOperation({
    summary: 'High-level overview: students, subjects, pass %, avg %',
  })
  async overview(
    @Query('academicYearId') academicYearId: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: number,
  ) {
    return this.service.getOverview({
      academicYearId,
      branchId,
      schemeId,
      semester: semester !== undefined ? Number(semester) : undefined,
    });
  }

  @Get('pass-fail')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'PRINCIPAL')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Detailed pass/fail breakdown with class buckets' })
  async passFail(
    @Query('academicYearId') academicYearId: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: number,
  ) {
    return this.service.passFail({
      academicYearId,
      branchId,
      schemeId,
      semester: semester !== undefined ? Number(semester) : undefined,
    });
  }

  @Get('subjects')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'PRINCIPAL', 'TEACHER')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Per-subject statistics + difficulty rating' })
  async subjects(
    @Query('academicYearId') academicYearId: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: number,
  ) {
    return this.service.subjectStats({
      academicYearId,
      branchId,
      schemeId,
      semester: semester !== undefined ? Number(semester) : undefined,
    });
  }

  @Get('subject-difficulty')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'TEACHER')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Per-subject difficulty rating (alias of /subjects)' })
  async subjectDifficulty(
    @Query('academicYearId') academicYearId: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: number,
  ) {
    return this.service.subjectDifficulty({
      academicYearId,
      branchId,
      schemeId,
      semester: semester !== undefined ? Number(semester) : undefined,
    });
  }

  @Get('performance-trends')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'PRINCIPAL')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Year-over-year performance trends' })
  async performanceTrends(
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: number,
  ) {
    return this.service.performanceTrends({
      branchId,
      schemeId,
      semester: semester !== undefined ? Number(semester) : undefined,
    });
  }
}
