import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditService } from '@/common/services/audit.service';
import { AuthorisationService } from '@/common/services/authorisation.service';
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
    private readonly auditService: AuditService,
    private readonly authorisation: AuthorisationService,
    private readonly prisma: PrismaClient
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

  async findAll(params: AuditLogFilters, readerId: string) {
    return this.repository.findAll({
      ...params,
      actorIds: await this.actorIdsInScope(readerId),
    });
  }

  /**
   * The members whose actions the reader may read.
   *
   * A college-scoped reader may read the whole trail, so `undefined` is
   * returned and no restriction is applied. A branch-scoped reader may read
   * only the entries made by the members of their branch.
   *
   * The reader's own entries are always readable — a member must be able to
   * see what they did, even if their account's scope has since been
   * narrowed.
   */
  private async actorIdsInScope(readerId: string): Promise<string[] | undefined> {
    const scope = await this.authorisation.branchScope(readerId);
    if (scope.length === 0) return undefined;

    const assignments = await this.prisma.userRole.findMany({
      where: { branchId: { in: scope } },
      select: { userId: true },
      distinct: ['userId'],
    });

    const actorIds = new Set(assignments.map((a) => a.userId));
    actorIds.add(readerId);
    return [...actorIds];
  }

  /**
   * The distinct actions, resources and users present in the trail, for
   * building a screen's filter controls.
   *
   * Scoped the same way as the list: a branch-scoped reader's dropdowns
   * must not offer values that the list would then refuse to return.
   */
  async findFacets(readerId: string) {
    const actorIds = await this.actorIdsInScope(readerId);
    return this.repository.findFacets(actorIds);
  }

  async findById(id: string, readerId: string) {
    const actorIds = await this.actorIdsInScope(readerId);
    return this.repository.findById(id, actorIds);
  }
}
