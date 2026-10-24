import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma, User } from '@prisma/client';
import { CreateUserDto, UpdateUserDto } from './dto';

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
    createdBy: string,
  ): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        name: data.name,
        passwordHash,
        isActive: data.isActive ?? true,
        createdBy,
      },
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
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
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

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
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

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  }

  async update(
    id: string,
    data: Omit<UpdateUserDto, 'password'>,
    passwordHash: string | undefined,
    updatedBy: string,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email.toLowerCase().trim() } : {}),
        ...(passwordHash !== undefined ? { passwordHash } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedBy,
      },
    });
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false, updatedBy: deletedBy },
    });
  }
}