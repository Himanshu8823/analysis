import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';
import { CurrentUser, Permissions, Audited, AuditAction, AuditResource } from '@/common/decorators';
import type { JwtPayload } from '@/common/types';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Post()
  @Permissions('branches:write')
  @Audited(AuditResource.BRANCH, AuditAction.CREATE, { resourceIdSource: 'response' })
  @ApiOperation({ summary: 'Create new branch' })
  async create(@Body() dto: CreateBranchDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @Permissions('branches:read')
  @ApiOperation({ summary: 'List all branches' })
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions('branches:read')
  @ApiOperation({ summary: 'Get a branch by id' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @Permissions('branches:write')
  @Audited(AuditResource.BRANCH, AuditAction.UPDATE, { resourceIdSource: 'param' })
  @ApiOperation({ summary: 'Update a branch' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Permissions('branches:delete')
  @Audited(AuditResource.BRANCH, AuditAction.DELETE, { resourceIdSource: 'param' })
  @ApiOperation({ summary: 'Delete a branch' })
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    return this.service.delete(id, user.sub);
  }
}
