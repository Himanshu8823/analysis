import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { AuditLog } from '@prisma/client';

/**
 * The row to write. Declared in the repository — the lowest layer — so the
 * repository never has to import from the service above it.
 */
export interface LogAuditInput {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/** The filters `GET /audit-logs` accepts. */
export interface AuditLogFilters {
  page?: number;
  pageSize?: number;
  userId?: string;
  action?: string;
  resource?: string;
  fromDate?: Date;
  toDate?: Date;
  /** Free-text match over the resource id and the action. */
  search?: string;
  /** Exact match on the originating IP address. */
  ipAddress?: string;
  /**
   * Restricts the trail to entries made by these users.
   *
   * The audit log carries no branch of its own, so the branch scope of a
   * reader is applied through the *actor*: an entry is in a reader's trail
   * if the member who caused it is in the reader's scope. `undefined` means
   * no restriction — the reader may see the whole college's trail.
   */
  actorIds?: string[];
}

@Injectable()
export class AuditLogsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: LogAuditInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        details: input.details ? (input.details as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  async findAll(params: AuditLogFilters) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where = this.buildWhere(params);

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * The distinct actions, resources and users that appear in the trail.
   *
   * A screen needs these to build its filter dropdowns. Computing them with
   * `groupBy` keeps the cost proportional to the table rather than to the
   * number of rows a screen would otherwise have to fetch to discover them.
   *
   * `actorIds` applies the reader's branch scope, so the dropdowns only
   * offer values the list would actually return.
   */
  async findFacets(actorIds?: string[]) {
    const actorWhere: Prisma.AuditLogWhereInput =
      actorIds === undefined ? {} : { userId: { in: actorIds } };

    const [actions, resources, userIds] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: { action: 'asc' },
        where: actorWhere,
      }),
      this.prisma.auditLog.groupBy({
        by: ['resource'],
        _count: { resource: true },
        orderBy: { resource: 'asc' },
        where: actorWhere,
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { userId: { not: null }, ...actorWhere },
      }),
    ]);

    // The distinct users are fetched in one query and sorted here rather
    // than through a relation `orderBy`, which Prisma does not accept
    // alongside `distinct` on a to-one relation.
    const ids = userIds
      .map((row) => row.userId)
      .filter((id): id is string => typeof id === 'string');

    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, email: true, name: true },
        })
      : [];

    users.sort((a, b) => a.name.localeCompare(b.name));

    return {
      actions: actions.map((row) => ({ value: row.action, count: row._count.action })),
      resources: resources.map((row) => ({
        value: row.resource,
        count: row._count.resource,
      })),
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
      })),
    };
  }

  /**
   * A single entry.
   *
   * When `actorIds` is given, an entry made by a member outside the reader's
   * scope is reported as not found rather than as forbidden — the reader
   * must not be able to confirm that an entry they may not see exists.
   */
  async findById(id: string, actorIds?: string[]): Promise<AuditLog> {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!log) {
      throw new NotFoundException(`Audit log with id ${id} not found`);
    }
    if (actorIds && (!log.userId || !actorIds.includes(log.userId))) {
      throw new NotFoundException(`Audit log with id ${id} not found`);
    }
    return log;
  }

  /**
   * Translates the query filters into a Prisma `where` clause.
   *
   * The action and resource filters accept a comma-separated list so a
   * multi-select dropdown can be sent as one parameter.
   */
  private buildWhere(params: AuditLogFilters): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    if (params.userId) where.userId = params.userId;
    if (params.ipAddress) where.ipAddress = params.ipAddress;

    /**
     * The branch scope, applied through the actor.
     *
     * A reader who is scoped to a branch sees the entries made by the
     * members of that branch. An entry with no actor — a background job, a
     * failed sign-in that never resolved to a user — belongs to nobody and
     * is therefore not shown to a branch-scoped reader, but is shown to a
     * college-scoped one.
     */
    if (params.actorIds) {
      const requestedUserId = params.userId;
      if (requestedUserId) {
        // The caller named a user *and* the scope applies. The named user has
        // to be inside the scope, or the query matches nothing.
        where.userId = {
          in: params.actorIds.includes(requestedUserId) ? [requestedUserId] : [],
        };
      } else {
        where.userId = { in: params.actorIds };
      }
    }

    if (params.action) {
      const actions = splitFilter(params.action);
      // An all-blank value (`action=,,`) filters nothing rather than
      // everything, so a malformed query string cannot widen the result set.
      if (actions.length === 1) where.action = actions[0];
      else if (actions.length > 1) where.action = { in: actions };
    }

    if (params.resource) {
      const resources = splitFilter(params.resource);
      if (resources.length === 1) where.resource = resources[0];
      else if (resources.length > 1) where.resource = { in: resources };
    }

    if (params.fromDate || params.toDate) {
      where.createdAt = {};
      if (params.fromDate) where.createdAt.gte = params.fromDate;
      if (params.toDate) where.createdAt.lte = params.toDate;
    }

    if (params.search) {
      const search = params.search.trim();
      if (search) {
        where.OR = [
          { resourceId: { contains: search, mode: 'insensitive' } },
          { action: { contains: search, mode: 'insensitive' } },
          { resource: { contains: search, mode: 'insensitive' } },
        ];
      }
    }

    return where;
  }
}

/**
 * Splits a comma-separated filter value into its parts, dropping blanks.
 */
function splitFilter(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
