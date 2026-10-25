import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, from, of } from 'rxjs';
import { catchError, concatMap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { JwtPayload } from '@/common/types';
import { AuditService } from '@/common/services/audit.service';
import {
  AUDITED_KEY,
  AuditDescriptor,
  AuditedOptions,
} from '@/common/decorators/audited.decorator';

/**
 * A request that carries the authenticated principal, as the JWT guard and
 * the `CurrentUser` decorator leave it.
 */
type AuditedRequest = Request & { user?: JwtPayload };

/**
 * Records one audit row per audited mutation.
 *
 * The interceptor is passive: a route is only audited when it carries the
 * `@Audited` decorator, so read paths pay nothing.
 *
 * Three rules matter here:
 *
 * 1. **Only successful mutations are recorded.** A handler that throws
 *    changes nothing, so there is nothing to audit.
 * 2. **A failed audit write never fails the request.** The mutation has
 *    already been committed by the time the audit row is written; failing the
 *    response afterwards would leave the caller believing the change did not
 *    happen. The failure is logged instead.
 * 3. **The audit write is awaited before the response is returned.** A
 *    fire-and-forget write would race the process shutdown and lose rows.
 *
 * The interceptor is registered through `APP_INTERCEPTOR` rather than
 * `useGlobalInterceptors`, because it needs the audit service injected.
 *
 * Nest applies container-bound interceptors during `NestFactory.create()`,
 * before `useGlobalInterceptors` runs, so this one ends up **outermost** —
 * it sees the response envelope `{ success, data, timestamp }` produced by
 * the `TransformInterceptor`, and its audit write happens after the handler
 * but before the response reaches the client. The `unwrap` helper below
 * handles both that envelope and a bare handler result.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const descriptor = this.readDescriptor(context);

    if (!descriptor) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<AuditedRequest>();

    return next.handle().pipe(
      concatMap((result: unknown) => {
        const record = this.buildRecord(descriptor, req, result);
        if (!record) {
          return of(result);
        }

        // `AuditService.record` swallows its own errors, but the catch is kept
        // as a belt-and-braces guarantee that the audit path can never break
        // the request.
        return from(this.auditService.record(record)).pipe(
          catchError((error: unknown) => {
            this.logger.error(
              `Audit write failed for ${descriptor.action} on ${descriptor.resource}: ` +
                `${(error as Error).message}`
            );
            return of(undefined);
          }),
          concatMap(() => of(result))
        );
      })
    );
  }

  /**
   * Reads the `@Audited` metadata off the handler, falling back to the
   * controller. A handler-level descriptor wins over a controller-level one,
   * because the handler is the more specific statement of intent.
   */
  private readDescriptor(context: ExecutionContext): AuditDescriptor | null {
    const fromHandler = this.reflector.get<Partial<AuditDescriptor>>(
      AUDITED_KEY,
      context.getHandler()
    );
    const fromController = this.reflector.get<Partial<AuditDescriptor>>(
      AUDITED_KEY,
      context.getClass()
    );

    const descriptor = { ...fromController, ...fromHandler } as AuditDescriptor;

    if (!descriptor || descriptor.skip) return null;
    if (!descriptor.resource || !descriptor.action) return null;

    // The options are merged rather than replaced, so a controller-level
    // descriptor's refinements survive a handler-level override of just the
    // resource or the action.
    return {
      resource: descriptor.resource,
      action: descriptor.action,
      options: { ...(fromController?.options ?? {}), ...(fromHandler?.options ?? {}) },
      skip: descriptor.skip,
    };
  }

  /**
   * Assembles the audit row from the request and the handler's result.
   */
  private buildRecord(descriptor: AuditDescriptor, req: AuditedRequest, result: unknown) {
    const options: AuditedOptions = descriptor.options ?? {};
    const payload = this.unwrap(result);

    const resourceId = this.resolveResourceId(options, req, payload);

    const details: Record<string, unknown> = { ...(options.details ?? {}) };

    // Copy the named fields the route asked to record out of the request
    // body — a screen wants to show "roll no CS-042", not just an id.
    for (const [key, source] of Object.entries(options.detailsFromBody ?? {})) {
      const value = (req.body as Record<string, unknown> | undefined)?.[source];
      if (value === undefined) continue;
      // An array body field is recorded as its length, never as the array
      // itself — a bulk import of 5 000 rows must not land in the JSON column.
      details[key] = Array.isArray(value) ? value.length : value;
    }

    // A bulk operation returns a list or a summary; its size is the useful
    // detail.
    if (options.resourceIdSource === 'none') {
      if (Array.isArray(payload)) {
        details.count = payload.length;
      } else {
        Object.assign(details, this.pickCounts(payload));
      }
    }

    return {
      userId: req.user?.sub ?? null,
      action: descriptor.action,
      resource: descriptor.resource,
      resourceId,
      details: Object.keys(details).length > 0 ? details : undefined,
      requestContext: {
        ipAddress: this.resolveIp(req),
        userAgent: req.headers?.['user-agent'],
        method: req.method,
        route: req.route?.path ?? req.originalUrl ?? undefined,
      },
    };
  }

  /**
   * Finds the id of the audited entity. The source is configurable because
   * a create has no id in the request but does in the response, while an
   * update or delete has one in the route.
   */
  private resolveResourceId(
    options: AuditedOptions,
    req: AuditedRequest,
    payload: unknown
  ): string | undefined {
    const field = options.resourceIdField ?? 'id';
    const source = options.resourceIdSource ?? 'response';

    switch (source) {
      case 'none':
        return undefined;
      case 'param': {
        const value = (req.params as Record<string, unknown> | undefined)?.[field];
        return typeof value === 'string' ? value : undefined;
      }
      case 'body': {
        const value = (req.body as Record<string, unknown> | undefined)?.[field];
        return typeof value === 'string' ? value : undefined;
      }
      case 'response':
      default:
        return this.pickId(payload, field);
    }
  }

  /**
   * Unwraps the response envelope produced by the `TransformInterceptor`
   * (`{ success, data, timestamp }`), so the caller only ever deals with the
   * handler's own value.
   */
  private unwrap(result: unknown): unknown {
    if (!result || typeof result !== 'object') return result;

    const record = result as Record<string, unknown>;
    if ('success' in record && 'data' in record) {
      return record.data;
    }
    return result;
  }

  /**
   * Pulls an id out of a handler result. The result may be the entity
   * itself, an array of entities, or a wrapper object holding the entity
   * under a single key.
   */
  private pickId(result: unknown, field: string): string | undefined {
    if (!result || typeof result !== 'object') return undefined;

    const candidates: unknown[] = [result];

    // A wrapper object such as `{ student: {...} }` — look one level down
    // through every own property that is an object.
    for (const value of Object.values(result as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        candidates.push(value);
      }
    }

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;

      const value = (candidate as Record<string, unknown>)[field];
      if (typeof value === 'string') return value;

      // An array result: use the first element's id.
      if (Array.isArray(candidate)) {
        const first = candidate[0];
        if (first && typeof first === 'object') {
          const firstValue = (first as Record<string, unknown>)[field];
          if (typeof firstValue === 'string') return firstValue;
        }
      }
    }

    return undefined;
  }

  /**
   * Picks the size counters out of a bulk-operation result.
   *
   * Bulk imports report their size in a handful of shapes — `{ count }`,
   * `{ inserted, failed }`, `{ imported }` — so the counters are copied
   * wholesale rather than guessing one field name. Only numeric fields are
   * taken, and the error list is left out.
   */
  private pickCounts(payload: unknown): Record<string, number> {
    if (!payload || typeof payload !== 'object') return {};

    const counts: Record<string, number> = {};
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (typeof value === 'number') counts[key] = value;
    }
    return counts;
  }

  /**
   * Resolves the caller's IP address, preferring the left-most entry of
   * `X-Forwarded-For` (set by the reverse proxy) over the socket address.
   */
  private resolveIp(req: AuditedRequest): string | undefined {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0];
    }
    return req.ip ?? req.socket?.remoteAddress ?? undefined;
  }
}
