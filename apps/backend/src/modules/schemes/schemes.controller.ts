import {
  Controller, Get, Post, Put, Delete, Body, Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SchemesService } from './schemes.service';
import { CreateSchemeDto, UpdateSchemeDto } from './dto';
import { Roles, Permissions } from '@/common/decorators';

@ApiTags('Schemes')
@ApiBearerAuth()
@Controller('schemes')
export class SchemesController {
  constructor(private readonly service: SchemesService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('rbac:write')
  @ApiOperation({ summary: 'Create scheme' })
  async create(@Body() dto: CreateSchemeDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('marks:read')
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions('marks:read')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('rbac:write')
  async update(@Param('id') id: string, @Body() dto: UpdateSchemeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @Permissions('rbac:write')
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}