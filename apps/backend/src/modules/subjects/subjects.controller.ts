import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto';
import { Permissions, Audited, AuditAction, AuditResource } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';

@ApiTags('Subjects')
@ApiBearerAuth()
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly service: SubjectsService) {}

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
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('isActive') isActive?: string
  ) {
    return this.service.findAll({
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
      academicYearId: parseOptionalString(academicYearId),
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Get(':id')
  @Permissions('subjects:read')
  @ApiOperation({ summary: 'Get one subject with the places it is offered' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
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
