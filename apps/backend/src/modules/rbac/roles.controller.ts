import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionDto } from './dto';
import { Permissions } from '@/common/decorators';

@ApiTags('RBAC - Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Post()
  @Permissions('rbac:write')
  @ApiOperation({ summary: 'Create role' })
  async create(@Body() dto: CreateRoleDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('rbac:read')
  @ApiOperation({ summary: 'List all roles' })
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions('rbac:read')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get(':id/permissions')
  @Permissions('rbac:read')
  async getPermissions(@Param('id') id: string) {
    return this.service.getPermissions(id);
  }

  @Put(':id')
  @Permissions('rbac:write')
  async update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.service.update(id, dto);
  }

  @Put(':id/permissions')
  @Permissions('rbac:write')
  async assignPermissions(
    @Param('id') id: string,
    @Body() dto: AssignPermissionDto
  ): Promise<void> {
    return this.service.assignPermissions(id, dto);
  }

  @Delete(':id')
  @Permissions('rbac:write')
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}
