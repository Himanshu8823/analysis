import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SchemesService } from './schemes.service';
import { CreateSchemeDto, UpdateSchemeDto } from './dto';
import { Permissions, Audited, AuditAction, AuditResource } from '@/common/decorators';

@ApiTags('Schemes')
@ApiBearerAuth()
@Controller('schemes')
export class SchemesController {
  constructor(private readonly service: SchemesService) {}

  @Post()
  @Permissions('schemes:write')
  @Audited(AuditResource.SCHEME, AuditAction.CREATE, { resourceIdSource: 'response' })
  @ApiOperation({ summary: 'Create scheme' })
  async create(@Body() dto: CreateSchemeDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('schemes:read')
  @ApiOperation({ summary: 'List schemes' })
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions('schemes:read')
  @ApiOperation({ summary: 'Get a scheme by id' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @Permissions('schemes:write')
  @Audited(AuditResource.SCHEME, AuditAction.UPDATE, { resourceIdSource: 'param' })
  @ApiOperation({ summary: 'Update a scheme' })
  async update(@Param('id') id: string, @Body() dto: UpdateSchemeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('schemes:write')
  @Audited(AuditResource.SCHEME, AuditAction.DELETE, { resourceIdSource: 'param' })
  @ApiOperation({ summary: 'Delete a scheme' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}
