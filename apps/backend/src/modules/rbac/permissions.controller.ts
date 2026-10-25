import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto, UpdatePermissionDto } from './dto';
import { Permissions as Perms } from '@/common/decorators';

@ApiTags('RBAC - Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Post()
  @Perms('rbac:write')
  @ApiOperation({ summary: 'Create permission' })
  async create(@Body() dto: CreatePermissionDto) {
    return this.service.create(dto);
  }

  @Get()
  @Perms('rbac:read')
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Perms('rbac:read')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @Perms('rbac:write')
  async update(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Perms('rbac:write')
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}
