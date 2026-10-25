import { Global, Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditService } from '@/common/services/audit.service';

/**
 * `@Global()` because audit logging is cross-cutting: any module that mutates
 * data needs to record the change, and threading an import through every
 * feature module would be noise. `AuditService` is the write path every
 * module uses — including the `AuditInterceptor`, which resolves it through
 * the global container.
 */
@Global()
@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogsService, AuditLogsRepository, AuditService],
  exports: [AuditLogsService, AuditService],
})
export class AuditLogsModule {}
