import {
  Controller, Get, Post, Put, Delete, Body, Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionDto } from './dto';
import { Roles, Permissions } from '@/common/decorators';

@ApiTags('RBAC - Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Post()
  @Roles('SUPER_ADMIN')
  @Permissions('rbac:write')
  @ApiOperation({ summary: 'Create role' })
  async create(@Body() dto: CreateRoleDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('rbac:read')
  @ApiOperation({ summary: 'List all roles' })
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('rbac:read')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get(':id/permissions')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('rbac:read')
  async getPermissions(@Param('id') id: string) {
    return this.service.getPermissions(id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN')
  @Permissions('rbac:write')
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.service.update(id, dto);
  }

  @Put(':id/permissions')
  @Roles('SUPER_ADMIN')
  @Permissions('rbac:write')
  async assignPermissions(
    @Param('id') id: string,
    @Body() dto: AssignPermissionDto,
  ): Promise<void> {
    return this.service.assignPermissions(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @Permissions('rbac:write')
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}