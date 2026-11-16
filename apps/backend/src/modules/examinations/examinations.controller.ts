import { Controller, Get, Post, Body, Param, Query, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ExaminationsService } from './examinations.service';
import { CreateExaminationDto } from './dto/create-examination.dto';
import { Permissions, CurrentUser, Audited, AuditAction, AuditResource } from '@/common/decorators';
import { ScopeService } from '@/common/services/scope.service';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

/**
 * The examinations of a class, and the publication of its result.
 *
 * This is the last step of the college's cycle: everything before it
 * produces a working sheet of marks, and this is the moment the result
 * becomes the answer the college gives.
 */
@ApiTags('Examinations')
@ApiBearerAuth()
@Controller('examinations')
export class ExaminationsController {
  constructor(
    private readonly service: ExaminationsService,
    private readonly scope: ScopeService
  ) {}

  @Get()
  @Permissions('examinations:read')
  @ApiOperation({ summary: 'List the examinations, with how ready each result is' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'semester', required: false })
  @ApiQuery({ name: 'academicYearId', required: false })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
    @Query('semester') semester?: string,
    @Query('academicYearId') academicYearId?: string
  ) {
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.findAll({
      branchIds: effectiveBranchIds,
      semester: parseOptionalInt(semester),
      academicYearId: parseOptionalString(academicYearId),
    });
  }

  @Get(':id')
  @Permissions('examinations:read')
  @ApiOperation({ summary: 'Get one examination' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Permissions('examinations:write')
  @Audited(AuditResource.EXAMINATION, AuditAction.CREATE, {
    resourceIdSource: 'response',
    detailsFromBody: {
      name: 'name',
      branchId: 'branchId',
      semester: 'semester',
      schemeId: 'schemeId',
      academicYearId: 'academicYearId',
      examDate: 'examDate',
    },
  })
  @ApiOperation({ summary: 'Open an examination for a class' })
  async create(@Body() dto: CreateExaminationDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(
      {
        ...dto,
        examDate: new Date(dto.examDate),
      },
      user.sub
    );
  }

  /**
   * Publishes a class's result.
   *
   * The act that turns a working sheet of marks into the college's answer.
   * It is refused unless every student's result is in.
   */
  @Post(':id/publish')
  @Permissions('examinations:write')
  @Audited(AuditResource.EXAMINATION, AuditAction.UPDATE, {
    resourceIdSource: 'param',
  })
  @ApiOperation({
    summary: "Publish a class's result",
    description: 'Refused unless every student in the class has a complete result.',
  })
  async publish(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.publish(id, user.sub);
  }

  /**
   * Returns a published result to being worked on.
   *
   * For the case where a mark was found to be wrong after the result went
   * out. The marks are not changed here — a correction is a separate act —
   * but the result stops being the college's answer while it is fixed.
   */
  @Delete(':id/publish')
  @Permissions('examinations:write')
  @Audited(AuditResource.EXAMINATION, AuditAction.UPDATE, {
    resourceIdSource: 'param',
  })
  @ApiOperation({ summary: 'Return a published result to being worked on' })
  async unpublish(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.unpublish(id, user.sub);
  }
}
