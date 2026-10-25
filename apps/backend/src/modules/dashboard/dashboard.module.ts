import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardScopeRepository } from './dashboard-scope.repository';
import { RbacModule } from '@/modules/rbac/rbac.module';

@Module({
  controllers: [DashboardController],
  // `RbacModule` is imported for `PermissionsCacheRepository`, the single
  // source of truth for a member's effective permissions.
  imports: [RbacModule],
  providers: [DashboardService, DashboardScopeRepository],
  exports: [DashboardService],
})
export class DashboardModule {}
