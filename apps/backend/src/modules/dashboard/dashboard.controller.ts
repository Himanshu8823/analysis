import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DashboardService } from './dashboard.service';
import { DashboardScopeRepository } from './dashboard-scope.repository';
import { Permissions } from '@/common/decorators';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly service: DashboardService,
    private readonly scopeRepository: DashboardScopeRepository
  ) {}

  /**
   * The dashboard for the signed-in member.
   *
   * The payload is role-aware: the scope and the metrics are decided from the
   * caller's *effective permissions*, so a member holding several roles gets
   * the union of what those roles allow (§3.1). The `branchId`, `schemeId` and
   * `semester` parameters only narrow within the caller's own scope — they
   * can never widen it.
   *
   * There is no `@Roles(...)` here on purpose: role names are labels for
   * permission bundles, and gating on them would defeat the permission model.
   */
  @Get()
  @Permissions('dashboard:read')
  @Throttle({ default: { limit: 60, ttl: 60 * 1000 } }) // 60/min/user
  @ApiOperation({
    summary: "Role-aware dashboard — KPIs and chart sections scoped to the caller's permissions",
  })
  async dashboard(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string
  ) {
    const viewer = await this.scopeRepository.loadViewer(user.sub);
    return this.service.getDashboard(viewer, this.parseScope(branchId, schemeId, semester));
  }

  /**
   * The scope block — the fastest part of the dashboard.
   *
   * The web app requests this first so the page title and scope banner can
   * render while the KPIs and charts are still being computed.
   */
  @Get('header')
  @Permissions('dashboard:read')
  @Throttle({ default: { limit: 120, ttl: 60 * 1000 } })
  @ApiOperation({ summary: 'Dashboard scope block' })
  async header(@CurrentUser() user: JwtPayload) {
    const viewer = await this.scopeRepository.loadViewer(user.sub);
    return this.service.getHeader(viewer);
  }

  /**
   * The KPI cards. Independent of the chart sections so the metric row can
   * paint as soon as its own figures are ready.
   */
  @Get('metrics')
  @Permissions('dashboard:read')
  @Throttle({ default: { limit: 120, ttl: 60 * 1000 } })
  @ApiOperation({ summary: 'Dashboard KPI cards' })
  async metrics(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string
  ) {
    const viewer = await this.scopeRepository.loadViewer(user.sub);
    return this.service.getMetrics(viewer, this.parseScope(branchId, schemeId, semester));
  }

  /**
   * The chart blocks. The heaviest block, isolated so it never holds the
   * metric cards or the upload feed hostage.
   */
  @Get('sections')
  @Permissions('dashboard:read')
  @Throttle({ default: { limit: 120, ttl: 60 * 1000 } })
  @ApiOperation({ summary: 'Dashboard chart sections' })
  async sections(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string
  ) {
    const viewer = await this.scopeRepository.loadViewer(user.sub);
    return this.service.getSections(viewer, this.parseScope(branchId, schemeId, semester));
  }

  /** The latest upload jobs — a single small read. */
  @Get('recent-uploads')
  @Permissions('dashboard:read')
  @Throttle({ default: { limit: 120, ttl: 60 * 1000 } })
  @ApiOperation({ summary: 'Dashboard recent uploads' })
  async recentUploads(@CurrentUser() user: JwtPayload) {
    const viewer = await this.scopeRepository.loadViewer(user.sub);
    return this.service.getRecentUploads(viewer);
  }

  private parseScope(branchId?: string, schemeId?: string, semester?: string) {
    return {
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    };
  }
}
