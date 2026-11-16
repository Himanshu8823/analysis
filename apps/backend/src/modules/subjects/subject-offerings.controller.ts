import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SubjectsService } from './subjects.service';
import { CreateSubjectOfferingDto } from './dto';
import {
  AnyPermission,
  Permissions,
  Audited,
  AuditAction,
  AuditResource,
  CurrentUser,
} from '@/common/decorators';
import { ScopeService } from '@/common/services/scope.service';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

/**
 * Subject offerings — "which subject runs in which branch, semester and scheme".
 *
 * These are kept on their own path rather than nested under `/subjects` so
 * that the subject catalogue and the teaching plan can be loaded separately:
 * a teacher picking a subject to enter marks for needs the offering, not the
 * catalogue.
 */
@ApiTags('Subject Offerings')
@ApiBearerAuth()
@Controller('subject-offerings')
export class SubjectOfferingsController {
  constructor(
    private readonly service: SubjectsService,
    private readonly scope: ScopeService
  ) {}

  @Post()
  @Permissions('subject_offerings:write')
  @Audited(AuditResource.SUBJECT_OFFERING, AuditAction.CREATE, {
    resourceIdSource: 'response',
    detailsFromBody: {
      subjectId: 'subjectId',
      branchId: 'branchId',
      semester: 'semester',
      schemeId: 'schemeId',
    },
  })
  @ApiOperation({ summary: 'Offer a subject in a branch, semester and scheme' })
  async create(@Body() dto: CreateSubjectOfferingDto) {
    return this.service.createOffering(dto);
  }

  @Get()
  @Permissions('subject_offerings:read', 'subjects:read')
  @ApiOperation({ summary: 'List subject offerings' })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'schemeId', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'semester', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('subjectId') subjectId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('semester') semester?: string,
    @Query('isActive') isActive?: string
  ) {
    /**
     * An offering is the teaching plan of one branch, so it is read under
     * the branch scope. A branch-scoped member sees their own branch's
     * offerings and no others; asking for another branch is refused rather
     * than quietly redirected.
     */
    const branchIds = await this.scope.resolveBranchFilter(user.sub, parseOptionalString(branchId));

    return this.service.findOfferings({
      subjectId: parseOptionalString(subjectId),
      branchIds,
      schemeId: parseOptionalString(schemeId),
      academicYearId: parseOptionalString(academicYearId),
      semester: parseOptionalInt(semester),
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Get(':id')
  @Permissions('subject_offerings:read', 'subjects:read')
  @ApiOperation({ summary: 'Get one subject offering' })
  async findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const offering = await this.service.findOfferingById(id);
    if (!offering) return null;

    /**
     * An offering belongs to a branch. A member who does not work in that
     * branch may not read it — an offering says which subjects that branch
     * teaches and in which semester, which is that branch's teaching plan.
     */
    const branchIds = await this.scope.resolveBranchFilter(user.sub, offering.branchId);
    if (branchIds && !branchIds.includes(offering.branchId)) {
      return null;
    }

    return offering;
  }

  @Put(':id')
  @Permissions('subject_offerings:write')
  @Audited(AuditResource.SUBJECT_OFFERING, AuditAction.UPDATE, {
    resourceIdSource: 'param',
  })
  @ApiOperation({ summary: 'Update subject offering' })
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateSubjectOfferingDto>,
    @CurrentUser() user: JwtPayload
  ) {
    const offering = await this.service.findOfferingById(id);
    if (!offering) return null;

    const branchIds = await this.scope.resolveBranchFilter(user.sub, offering.branchId);
    if (branchIds && !branchIds.includes(offering.branchId)) {
      return null;
    }

    return this.service.updateOffering(id, dto);
  }

  @Delete(':id')
  @AnyPermission('subject_offerings:write', 'subjects:delete')
  @Audited(AuditResource.SUBJECT_OFFERING, AuditAction.DELETE, {
    resourceIdSource: 'param',
  })
  @ApiOperation({ summary: 'Deactivate subject offering' })
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    const offering = await this.service.findOfferingById(id);
    if (!offering) return;

    const branchIds = await this.scope.resolveBranchFilter(user.sub, offering.branchId);
    if (branchIds && !branchIds.includes(offering.branchId)) {
      return;
    }

    return this.service.deleteOffering(id);
  }
}
