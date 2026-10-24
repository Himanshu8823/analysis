import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DashboardService } from './dashboard.service';
import { Roles, Permissions } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'PRINCIPAL', 'TEACHER', 'STUDENT')
  @Permissions('dashboard:read')
  @Throttle({ default: { limit: 60, ttl: 60 * 1000 } }) // 60/min/user
  @ApiOperation({
    summary: 'Dashboard KPIs (students, subjects, pass %, avg %) and recent uploads',
  })
  async dashboard(
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
  ) {
    return this.service.getDashboard({
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    });
  }
}
