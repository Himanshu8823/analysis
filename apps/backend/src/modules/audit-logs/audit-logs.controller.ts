import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { Permissions } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get()
  @Permissions('audit:read')
  @ApiOperation({
    summary: 'List audit logs (paginated, filterable)',
    description:
      'Filters: userId, action (comma-separated list allowed), resource ' +
      '(comma-separated list allowed), fromDate, toDate, search, ipAddress. ' +
      'Paging: page (1-based), pageSize (max 100).',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'resource', required: false, type: String })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'ipAddress', required: false, type: String })
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('search') search?: string,
    @Query('ipAddress') ipAddress?: string
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
      search: parseOptionalString(search),
      ipAddress: parseOptionalString(ipAddress),
    });
  }

  /**
   * The distinct actions, resources and users present in the trail.
   *
   * Declared before `@Get(':id')` so the literal path wins over the
   * parameter route.
   */
  @Get('facets')
  @Permissions('audit:read')
  @ApiOperation({
    summary: 'Distinct actions, resources and users in the audit trail',
    description:
      'Intended for building filter dropdowns, so a screen never has to ' +
      'discover the available values by paging through the whole trail.',
  })
  async findFacets() {
    return this.service.findFacets();
  }

  @Get(':id')
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Get single audit log entry' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }
}
