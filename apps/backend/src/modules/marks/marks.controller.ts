import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MarksService } from './marks.service';
import { CreateMarkDto, BulkCreateMarksDto, UpdateMarkDto } from './dto';
import { Permissions, CurrentUser, Audited, AuditAction, AuditResource } from '@/common/decorators';
import { ScopeService } from '@/common/services/scope.service';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

@ApiTags('Marks')
@ApiBearerAuth()
@Controller('marks')
export class MarksController {
  constructor(
    private readonly service: MarksService,
    private readonly scope: ScopeService
  ) {}

  @Post()
  @Permissions('marks:enter_own_subject')
  @Audited(AuditResource.MARK, AuditAction.CREATE, {
    resourceIdSource: 'response',
    detailsFromBody: {
      studentId: 'studentId',
      subjectOfferingId: 'subjectOfferingId',
      examType: 'examType',
      marksObtained: 'marksObtained',
    },
  })
  @ApiOperation({ summary: 'Create or upsert a single mark entry' })
  async create(@Body() dto: CreateMarkDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Post('bulk')
  @Permissions('marks:enter_own_subject')
  @Audited(AuditResource.MARK, AuditAction.BULK_IMPORT, {
    resourceIdSource: 'none',
    detailsFromBody: { rowCount: 'marks' },
  })
  @ApiOperation({ summary: 'Bulk upsert marks (e.g. spreadsheet import)' })
  async createBulk(@Body() dto: BulkCreateMarksDto, @CurrentUser() user: JwtPayload) {
    return this.service.createBulk(dto, user.sub);
  }

  @Get()
  @Permissions('marks:read')
  @ApiOperation({ summary: 'List marks with optional filters' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('studentId') studentId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('subjectOfferingId') subjectOfferingId?: string,
    @Query('examType') examType?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('branchId') branchId?: string
  ) {
    // A branch-scoped user only ever sees marks of students in their own
    // branches; asking for a different branch is rejected, not overridden.
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.findAll({
      studentId: parseOptionalString(studentId),
      subjectId: parseOptionalString(subjectId),
      subjectOfferingId: parseOptionalString(subjectOfferingId),
      examType: parseOptionalString(examType),
      academicYearId: parseOptionalString(academicYearId),
      branchId: effectiveBranchIds,
    });
  }

  // Static segments are declared before `@Get(':id')` so the literal paths win
  // over the parameter route.
  @Get('calculate/class')
  @Permissions('marks:read')
  @ApiOperation({
    summary: 'Calculate every student in a class (branch+scheme+semester+academicYear)',
  })
  async calculateClass(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId: string,
    @Query('schemeId') schemeId: string,
    @Query('semester') semester: string,
    @Query('academicYearId') academicYearId: string
  ) {
    // The class belongs to exactly one branch, so a branch-scoped caller may
    // only ask for their own; a different branch is rejected.
    const effectiveBranchId = await this.scope.resolveBranchScope(user.sub, branchId);

    return this.service.calculateClassResult({
      branchId: effectiveBranchId ?? branchId,
      schemeId,
      semester: parseOptionalInt(semester),
      academicYearId,
    });
  }

  @Get('calculate/:studentId')
  @Permissions('marks:read')
  @ApiOperation({
    summary: 'Calculate student result using scheme-aware calculator (2019/2022/2024)',
  })
  async calculate(
    @CurrentUser() user: JwtPayload,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string
  ) {
    // The student must sit in a branch the caller may see.
    const branchId = await this.service.findBranchIdOfStudent(studentId);
    if (!branchId) throw new NotFoundException('Student not found');
    await this.assertBranchVisible(user.sub, branchId);

    return this.service.calculateStudentResult(studentId, academicYearId);
  }

  @Get(':id')
  @Permissions('marks:read')
  async findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    // A mark has no branch of its own, so the scope is checked against the
    // branch of the student it belongs to.
    const branchId = await this.service.findBranchIdOfMark(id);
    if (!branchId) throw new NotFoundException('Mark not found');
    await this.assertBranchVisible(user.sub, branchId);

    return this.service.findById(id);
  }

  /**
   * Rejects the read when the record's branch is outside the caller's scope.
   *
   * A college-scoped caller may see any branch. A branch-scoped caller may
   * only see their own; `resolveBranchScope` with the record's branch throws
   * when the two do not match.
   */
  private async assertBranchVisible(userId: string, recordBranchId: string): Promise<void> {
    await this.scope.resolveBranchScope(userId, recordBranchId);
  }

  @Put(':id')
  @Permissions('marks:enter_own_subject')
  @Audited(AuditResource.MARK, AuditAction.UPDATE, {
    resourceIdSource: 'param',
    detailsFromBody: { marksObtained: 'marksObtained' },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMarkDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Permissions('marks:enter_own_subject')
  @Audited(AuditResource.MARK, AuditAction.DELETE, { resourceIdSource: 'param' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}
