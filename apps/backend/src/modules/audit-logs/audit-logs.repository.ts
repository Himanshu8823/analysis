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
   */
  async findFacets() {
    const [actions, resources, userIds] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: { action: 'asc' },
      }),
      this.prisma.auditLog.groupBy({
        by: ['resource'],
        _count: { resource: true },
        orderBy: { resource: 'asc' },
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: { userId: { not: null } },
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

  async findById(id: string): Promise<AuditLog> {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!log) {
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
