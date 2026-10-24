import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Permission } from '@prisma/client';
import { CreatePermissionDto, UpdatePermissionDto } from './dto';

@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreatePermissionDto): Promise<Permission> {
    return this.prisma.permission.create({
      data: {
        name: data.name,
        resource: data.resource,
        action: data.action,
        description: data.description,
      },
    });
  }

  async findAll(): Promise<Permission[]> {
    return this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  async findById(id: string): Promise<Permission | null> {
    return this.prisma.permission.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdatePermissionDto): Promise<Permission> {
    return this.prisma.permission.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.resource !== undefined ? { resource: data.resource } : {}),
        ...(data.action !== undefined ? { action: data.action } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.permission.delete({ where: { id } });
  }
}