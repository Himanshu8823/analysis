import { Injectable } from '@nestjs/common';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditService } from '@/common/services/audit.service';
import type { AuditLogFilters, LogAuditInput } from './audit-logs.repository';

/**
 * Re-exported for the modules that still call `AuditLogsService.log()`.
 * The shape lives in the repository now, so the repository does not depend
 * on the service.
 */
export type { LogAuditInput };

/**
 * The read side of the audit trail, plus the legacy write entry point.
 *
 * Writes go through {@link AuditService} so there is exactly one write path:
 * the auth, invite and password-reset modules call `log()` (which delegates
 * to `AuditService.record()`), and the `AuditInterceptor` calls
 * `AuditService.record()` directly for `@Audited` routes.
 */
@Injectable()
export class AuditLogsService {
  constructor(
    private readonly repository: AuditLogsRepository,
    private readonly auditService: AuditService
  ) {}

  /**
   * Records an audit row.
   *
   * Kept for the modules that already call it. New code should use
   * `AuditService.record()` — or, on a controller route, the `@Audited`
   * decorator.
   */
  async log(input: LogAuditInput): Promise<void> {
    await this.auditService.record({
      userId: input.userId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      details: input.details,
      requestContext: {
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async findAll(params: AuditLogFilters) {
    return this.repository.findAll(params);
  }

  /**
   * The distinct actions, resources and users present in the trail, for
   * building a screen's filter controls.
   */
  async findFacets() {
    return this.repository.findFacets();
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }
}
