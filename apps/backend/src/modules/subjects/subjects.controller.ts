import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto';
import { Permissions, Audited, AuditAction, AuditResource, CurrentUser } from '@/common/decorators';
import { ScopeService } from '@/common/services/scope.service';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

@ApiTags('Subjects')
@ApiBearerAuth()
@Controller('subjects')
export class SubjectsController {
  constructor(
    private readonly service: SubjectsService,
    private readonly scope: ScopeService
  ) {}

  @Post()
  @Permissions('subjects:write')
  @Audited(AuditResource.SUBJECT, AuditAction.CREATE, {
    resourceIdSource: 'response',
    detailsFromBody: { code: 'code', name: 'name' },
  })
  @ApiOperation({ summary: 'Create subject' })
  async create(@Body() dto: CreateSubjectDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('subjects:read')
  @ApiOperation({ summary: 'List subjects in the catalogue' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'schemeId', required: false })
  @ApiQuery({ name: 'semester', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('isActive') isActive?: string
  ) {
    /**
     * The catalogue is read under the branch scope, because the subjects
     * a branch teaches are that branch's teaching plan. A branch-scoped
     * member sees the subjects their branch offers and no others.
     */
    const branchIds = await this.scope.resolveBranchFilter(user.sub, parseOptionalString(branchId));

    return this.service.findAll({
      branchIds,
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
      academicYearId: parseOptionalString(academicYearId),
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Get(':id')
  @Permissions('subjects:read')
  @ApiOperation({ summary: 'Get one subject with the places it is offered' })
  async findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const subject = await this.service.findById(id);

    /**
     * The subject carries the places it is offered. Those places are the
     * teaching plans of the branches that offer it, so a member sees only
     * the offerings of the branches they work in.
     */
    const branchIds = await this.scope.resolveBranchFilter(user.sub);
    if (!branchIds) return subject;

    return {
      ...subject,
      offerings: subject.offerings.filter((offering) => branchIds.includes(offering.branchId)),
      _count: {
        offerings: subject.offerings.filter((offering) => branchIds.includes(offering.branchId))
          .length,
      },
    };
  }

  @Put(':id')
  @Permissions('subjects:write')
  @Audited(AuditResource.SUBJECT, AuditAction.UPDATE, {
    resourceIdSource: 'param',
    detailsFromBody: { code: 'code', name: 'name' },
  })
  @ApiOperation({ summary: 'Update subject' })
  async update(@Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('subjects:delete')
  @Audited(AuditResource.SUBJECT, AuditAction.DELETE, { resourceIdSource: 'param' })
  @ApiOperation({ summary: 'Deactivate subject' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}
