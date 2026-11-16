import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';
import { CurrentUser, Permissions, Audited, AuditAction, AuditResource } from '@/common/decorators';
import { ScopeService } from '@/common/services/scope.service';
import type { JwtPayload } from '@/common/types';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(
    private readonly service: BranchesService,
    private readonly scope: ScopeService
  ) {}

  @Post()
  @Permissions('branches:write')
  @Audited(AuditResource.BRANCH, AuditAction.CREATE, { resourceIdSource: 'response' })
  @ApiOperation({ summary: 'Create new branch' })
  async create(@Body() dto: CreateBranchDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  /**
   * The branches a member may pick from.
   *
   * The list is narrowed to the branches the member actually works in. This
   * is what makes the branch picker on every screen correct: a Computer
   * Science teacher is offered Computer Science, and is never offered a
   * branch whose students and staff they cannot see anyway.
   */
  @Get()
  @Permissions('branches:read')
  @ApiOperation({ summary: 'List the branches available to the caller' })
  async findAll(@CurrentUser() user: JwtPayload) {
    const branchIds = await this.scope.resolveBranchFilter(user.sub);
    return this.service.findAll(branchIds);
  }

  @Get(':id')
  @Permissions('branches:read')
  @ApiOperation({ summary: 'Get a branch by id' })
  async findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    /**
     * A branch is only visible to a member who works in it. A member of one
     * branch must not read the record of another — the branch row carries
     * its own details, and it is the anchor every other branch-scoped
     * record hangs from.
     */
    const branchIds = await this.scope.resolveBranchFilter(user.sub, id);
    if (branchIds && !branchIds.includes(id)) {
      return null;
    }
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
