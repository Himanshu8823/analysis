import {
  Controller, Get, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Roles, Permissions } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('rbac:read')
  @ApiOperation({ summary: 'List audit logs (paginated, filterable)' })
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    // An unparseable date is dropped rather than passed to `new Date()`, which
    // would otherwise yield an Invalid Date and break the range filter.
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;

    return this.service.findAll({
      page: parseOptionalInt(page),
      pageSize: parseOptionalInt(pageSize),
      userId: parseOptionalString(userId),
      action: parseOptionalString(action),
      resource: parseOptionalString(resource),
      fromDate: from && !Number.isNaN(from.getTime()) ? from : undefined,
      toDate: to && !Number.isNaN(to.getTime()) ? to : undefined,
    });
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('rbac:read')
  @ApiOperation({ summary: 'Get single audit log entry' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }
}