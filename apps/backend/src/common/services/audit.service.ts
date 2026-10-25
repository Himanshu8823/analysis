import { Injectable, Logger } from '@nestjs/common';
import { AuditLogsRepository } from '@/modules/audit-logs/audit-logs.repository';

/**
 * Where the request that triggered a mutation came from. The interceptor
 * fills this in from the Express request; services that mutate data outside
 * a request (queue processors) may omit it.
 */
export interface AuditRequestContext {
  ipAddress?: string;
  userAgent?: string;
  /** The HTTP method and route, recorded as detail for cross-referencing. */
  method?: string;
  route?: string;
}

export interface AuditRecordInput {
  /** Who made the change. `null` for system-driven changes. */
  userId?: string | null;
  /** The kind of change, e.g. `CREATE`, `UPDATE`, `BULK_IMPORT`. */
  action: string;
  /** The entity that changed, e.g. `student`, `mark`. */
  resource: string;
  /** The id of the changed entity, when there is one. */
  resourceId?: string | null;
  /** Extra, human-readable context about the change. */
  details?: Record<string, unknown>;
  /** Request metadata, when the change came from an HTTP request. */
  requestContext?: AuditRequestContext;
}

/**
 * The single write path for audit rows.
 *
 * Every module that mutates data records through here so the trail has one
 * shape and one place that decides what gets persisted. The service is
 * deliberately forgiving: a failed write is logged and swallowed, because the
 * mutation it describes has already been committed and failing the request
 * afterwards would be worse than a missing audit row.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly repository: AuditLogsRepository) {}

  /**
   * Writes one audit row.
   *
   * Never throws. A failure is logged with the action and resource so it can
   * be detected from the application log, and the row is dropped.
   */
  async record(input: AuditRecordInput): Promise<void> {
    const { userId, action, resource, resourceId, details, requestContext } = input;

    try {
      await this.repository.create({
        userId: userId ?? undefined,
        action,
        resource,
        resourceId: resourceId ?? undefined,
        details: this.buildDetails(details, requestContext),
        ipAddress: requestContext?.ipAddress,
        userAgent: requestContext?.userAgent,
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for ${action} on ${resource}` +
          `${resourceId ? ` (${resourceId})` : ''}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Merges the caller-supplied details with the request context. The context
   * is nested under `request` so it never collides with a business field
   * named `route` or `method`.
   */
  private buildDetails(
    details?: Record<string, unknown>,
    requestContext?: AuditRequestContext
  ): Record<string, unknown> | undefined {
    const merged: Record<string, unknown> = { ...(details ?? {}) };

    if (requestContext?.method || requestContext?.route) {
      merged.request = {
        ...(requestContext.method ? { method: requestContext.method } : {}),
        ...(requestContext.route ? { route: requestContext.route } : {}),
      };
    }

    return Object.keys(merged).length > 0 ? merged : undefined;
  }
}
