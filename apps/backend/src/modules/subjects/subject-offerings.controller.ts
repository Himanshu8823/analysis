import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SubjectsService } from './subjects.service';
import { CreateSubjectOfferingDto } from './dto';
import { Permissions, Audited, AuditAction, AuditResource } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';

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
  constructor(private readonly service: SubjectsService) {}

  @Post()
  @Permissions('subjects:write')
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
  @Permissions('subjects:read')
  @ApiOperation({ summary: 'List subject offerings' })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'schemeId', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  @ApiQuery({ name: 'semester', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  async findAll(
    @Query('subjectId') subjectId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('semester') semester?: string,
    @Query('isActive') isActive?: string
  ) {
    return this.service.findOfferings({
      subjectId: parseOptionalString(subjectId),
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      academicYearId: parseOptionalString(academicYearId),
      semester: parseOptionalInt(semester),
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Get(':id')
  @Permissions('subjects:read')
  @ApiOperation({ summary: 'Get one subject offering' })
  async findById(@Param('id') id: string) {
    return this.service.findOfferingById(id);
  }

  @Put(':id')
  @Permissions('subjects:write')
  @Audited(AuditResource.SUBJECT_OFFERING, AuditAction.UPDATE, {
    resourceIdSource: 'param',
  })
  @ApiOperation({ summary: 'Update subject offering' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateSubjectOfferingDto>) {
    return this.service.updateOffering(id, dto);
  }

  @Delete(':id')
  @Permissions('subjects:delete')
  @Audited(AuditResource.SUBJECT_OFFERING, AuditAction.DELETE, {
    resourceIdSource: 'param',
  })
  @ApiOperation({ summary: 'Deactivate subject offering' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.deleteOffering(id);
  }
}
