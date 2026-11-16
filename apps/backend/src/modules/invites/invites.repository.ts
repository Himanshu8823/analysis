import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Invite, InviteStatus, Prisma } from '@prisma/client';

export interface CreateInviteInput {
  email: string;
  name: string;
  roleName: string;
  branchId?: string | null;
  /** SHA-256 of the raw token — the raw token is never stored. */
  tokenHash: string;
  expiresAt: Date;
  invitedById: string;
}

@Injectable()
export class InvitesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateInviteInput): Promise<Invite> {
    return this.prisma.invite.create({
      data: {
        email: data.email.toLowerCase().trim(),
        name: data.name,
        roleName: data.roleName,
        branchId: data.branchId ?? null,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        invitedById: data.invitedById,
        status: 'PENDING',
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<Invite | null> {
    return this.prisma.invite.findUnique({ where: { tokenHash } });
  }

  async findById(id: string): Promise<Invite | null> {
    return this.prisma.invite.findUnique({ where: { id } });
  }

  /**
   * Finds the pending invitation for an email address, if any.
   * Used to supersede an outstanding invitation when a new one is sent.
   */
  async findPendingByEmail(email: string): Promise<Invite | null> {
    return this.prisma.invite.findFirst({
      where: { email: email.toLowerCase().trim(), status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Marks an invitation as revoked. */
  async revoke(id: string): Promise<Invite> {
    return this.prisma.invite.update({
      where: { id },
      data: { status: 'REVOKED' },
    });
  }

  /**
   * Marks an invitation as replaced by a newer one.
   *
   * The link is dead but the record is kept, so the history stays readable
   * and a stale invitation is not mistaken for a live one.
   */
  async supersede(id: string, supersededById: string): Promise<Invite> {
    return this.prisma.invite.update({
      where: { id },
      data: { status: 'REVOKED', supersededById },
    });
  }

  /** Marks an invitation as expired. */
  async markExpired(id: string): Promise<Invite> {
    return this.prisma.invite.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
  }

  async markAccepted(id: string): Promise<Invite> {
    return this.prisma.invite.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
  }

  /**
   * Lists invitations with optional status and search filters, newest first.
   *
   * `branchIds` narrows the list to the invitations that name one of those
   * branches, plus the invitations raised by `requestedBy`. The second half
   * matters: a college-wide invitation carries no branch, so it would
   * otherwise vanish from the list of the person who sent it.
   */
  async findAll(params: {
    status?: InviteStatus;
    search?: string;
    page?: number;
    pageSize?: number;
    branchIds?: string[];
    requestedBy?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where = this.buildWhere(params);

    const [items, total] = await Promise.all([
      this.prisma.invite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          invitedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.invite.count({ where }),
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

  /** Counts invitations grouped by status — used for the tab counters. */
  async countByStatus(params: {
    branchIds?: string[];
    requestedBy?: string;
  }): Promise<Record<InviteStatus, number>> {
    const grouped = await this.prisma.invite.groupBy({
      by: ['status'],
      where: this.buildWhere(params),
      _count: { _all: true },
    });

    const counts: Record<InviteStatus, number> = {
      PENDING: 0,
      ACCEPTED: 0,
      REVOKED: 0,
      EXPIRED: 0,
    };
    for (const row of grouped) {
      counts[row.status] = row._count._all;
    }
    return counts;
  }

  /**
   * The filter the list and the counters both use.
   *
   * The two have to agree: if the list is narrowed to a member's branches but
   * the counters are not, the tab shows "12 pending" over an empty list.
   */
  private buildWhere(params: {
    status?: InviteStatus;
    search?: string;
    branchIds?: string[];
    requestedBy?: string;
  }): Prisma.InviteWhereInput {
    const where: Prisma.InviteWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    /**
     * The scope filter.
     *
     * A branch-scoped member sees the invitations for their own branches,
     * and the ones they raised themselves. A college-wide member — whose
     * scope is `undefined` — sees everything, which is what the absence of
     * this filter means.
     *
     * An *empty* `branchIds` array is not the same as `undefined`: it means
     * "no branch at all", and the list must then be empty rather than
     * unfiltered. A member with no branch scope has nothing to see here.
     */
    if (params.branchIds) {
      const scope: Prisma.InviteWhereInput[] = [];
      if (params.branchIds.length > 0) {
        scope.push({ branchId: { in: params.branchIds } });
      }
      if (params.requestedBy) {
        scope.push({ invitedById: params.requestedBy });
      }
      // No clause at all means "matches nothing" — an empty `OR` is not a
      // valid Prisma filter.
      where.AND =
        scope.length > 0 ? [{ OR: scope }] : [{ id: '00000000-0000-0000-0000-000000000000' }];
    }

    return where;
  }
}
