import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Permission, Role } from '@prisma/client';
import { CreateRoleDto, UpdateRoleDto } from './dto';

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateRoleDto): Promise<Role> {
    return this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findAll(): Promise<Role[]> {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { userRoles: true, rolePermissions: true } },
      },
    });
  }

  async findById(id: string): Promise<Role | null> {
    return this.prisma.role.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateRoleDto): Promise<Role> {
    return this.prisma.role.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.role.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getPermissions(roleId: string): Promise<Permission[]> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
    if (!role) return [];
    return role.rolePermissions.map((rp) => rp.permission);
  }

  async assignPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
          skipDuplicates: true,
        });
      }
    });
  }
}
