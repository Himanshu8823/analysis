import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { CreateUserDto, UpdateUserDto } from './dto';

/**
 * The columns of a user that are safe to return over HTTP.
 *
 * `passwordHash` is deliberately absent. A bcrypt hash is enough to mount an
 * offline cracking attack, so it never leaves the auth module. Every read
 * path uses this one selection, so the shape cannot drift between endpoints.
 */
export const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  invitedById: true,
  invitedAt: true,
} satisfies Prisma.UserSelect;

/** A user row without the password hash. */
export type PublicUser = Prisma.UserGetPayload<{ select: typeof USER_PUBLIC_SELECT }>;

/**
 * A user row without the password hash, together with the roles assigned to
 * them. This is the shape the API returns for a single member.
 */
export type UserWithRoles = PublicUser & {
  roles: Array<{
    roleId: string;
    roleName: string;
    roleDescription: string | null;
    branchId: string | null;
  }>;
};

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * `passwordHash` is a separate argument rather than a DTO field, so a client
   * can never submit a pre-computed hash — the service layer always hashes.
   */
  async create(
    data: Omit<CreateUserDto, 'password'>,
    passwordHash: string,
    createdBy: string
  ): Promise<PublicUser> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        name: data.name,
        passwordHash,
        isActive: data.isActive ?? true,
        createdBy,
      },
      select: USER_PUBLIC_SELECT,
    });
  }

  async findAll(params: { page?: number; pageSize?: number; search?: string; isActive?: boolean }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: USER_PUBLIC_SELECT,
      }),
      this.prisma.user.count({ where }),
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
   * Fetches a single user without the password hash.
   *
   * `passwordHash` is never returned — this row is serialised straight into an
   * HTTP response, and a leaked hash is enough to mount an offline cracking
   * attack. The assigned roles come along because the member screens need
   * them to render the role chips and the branch scope.
   */
  async findById(id: string): Promise<UserWithRoles | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_PUBLIC_SELECT,
        userRoles: {
          select: {
            id: true,
            branchId: true,
            grantedAt: true,
            role: { select: { id: true, name: true, description: true } },
          },
          orderBy: { grantedAt: 'desc' },
        },
      },
    });

    if (!user) return null;

    const { userRoles, ...publicFields } = user;

    return {
      ...publicFields,
      roles: userRoles.map((ur) => ({
        roleId: ur.role.id,
        roleName: ur.role.name,
        roleDescription: ur.role.description,
        branchId: ur.branchId,
      })),
    };
  }

  /**
   * Lists members with their assigned roles.
   *
   * The `User` table has no role column — roles live in `UserRole`. Filtering by
   * role therefore filters on the relation, not on a column.
   */
  async findMembers(params: {
    search?: string;
    role?: string;
    branchId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {};
    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    // Role and branch filters both live on the `userRoles` relation, so they
    // have to be combined into a single predicate — assigning `where.userRoles`
    // twice would silently drop the first filter.
    if (params.role || params.branchId) {
      where.userRoles = {
        some: {
          ...(params.role ? { role: { name: params.role } } : {}),
          ...(params.branchId ? { branchId: params.branchId } : {}),
        },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          createdAt: true,
          userRoles: {
            select: {
              branchId: true,
              role: { select: { name: true } },
            },
            orderBy: { grantedAt: 'desc' },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        roles: user.userRoles.map((ur) => ({
          roleName: ur.role.name,
          branchId: ur.branchId,
        })),
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /** Lists every role with its member count — used by the Roles tab. */
  async findRolesWithCounts() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        _count: { select: { userRoles: true, rolePermissions: true } },
      },
    });
  }

  /**
   * Looks a user up by email for the administration screens. The password
   * hash is not selected — nothing outside the auth module needs it, and
   * this row may end up in an HTTP response.
   */
  async findByEmail(email: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: USER_PUBLIC_SELECT,
    });
  }

  async update(
    id: string,
    data: Omit<UpdateUserDto, 'password'>,
    passwordHash: string | undefined,
    updatedBy: string
  ): Promise<UserWithRoles> {
    /**
     * The updated row is read back with the same column selection as
     * `findById`, so a password change never echoes the new hash back to
     * the client.
     */
    await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email.toLowerCase().trim() } : {}),
        ...(passwordHash !== undefined ? { passwordHash } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedBy,
      },
    });

    const updated = await this.findById(id);
    if (!updated) {
      throw new NotFoundException('User not found');
    }
    return updated;
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, updatedBy: deletedBy },
    });
  }
}
