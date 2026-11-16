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
import { MarksScopeService } from './marks-scope.service';
import { CreateMarkDto, BulkCreateMarksDto, UpdateMarkDto, CorrectMarkDto } from './dto';
import {
  AnyPermission,
  Permissions,
  CurrentUser,
  Audited,
  AuditAction,
  AuditResource,
} from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import { RequestTimeout } from '@/common/interceptors/timeout.interceptor';
import type { JwtPayload } from '@/common/types';

@ApiTags('Marks')
@ApiBearerAuth()
@Controller('marks')
export class MarksController {
  constructor(
    private readonly service: MarksService,
    private readonly scope: MarksScopeService
  ) {}

  @Post()
  @AnyPermission('marks:enter_own_subject', 'marks:write')
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
  @AnyPermission('marks:enter_own_subject', 'marks:write')
  /**
   * A whole class is one request: a teacher's sheet for forty students
   * across eight subjects is three hundred and twenty rows, and each one is
   * an upsert. That is real work, and the default thirty-second timeout
   * would cut it off halfway — which would leave the member unable to tell
   * which rows were saved.
   *
   * The timeout is longer, and the write is still **whole**: a refused
   * batch writes nothing at all.
   */
  @RequestTimeout(120_000)
  @Audited(AuditResource.MARK, AuditAction.BULK_IMPORT, {
    resourceIdSource: 'none',
    detailsFromBody: { rowCount: 'marks' },
  })
  @ApiOperation({ summary: 'Bulk upsert marks (e.g. spreadsheet import)' })
  async createBulk(@Body() dto: BulkCreateMarksDto, @CurrentUser() user: JwtPayload) {
    return this.service.createBulk(dto, user.sub);
  }

  /**
   * The exam cell's correction of a mark that a teacher holds.
   *
   * A separate route from ordinary mark entry, on purpose: a correction
   * overwrites work another person is responsible for, so it needs the
   * exam cell's `marks:write` permission, a written reason, and a distinct
   * audit action. It is recorded as a correction, never as an ordinary
   * entry — so "who changed this published score and why" always has an
   * answer.
   */
  @Post('correct')
  @Permissions('marks:write')
  @Audited(AuditResource.MARK, AuditAction.CORRECTION, {
    resourceIdSource: 'none',
    detailsFromBody: {
      studentId: 'studentId',
      subjectOfferingId: 'subjectOfferingId',
      examType: 'examType',
      marksObtained: 'marksObtained',
      reason: 'reason',
    },
  })
  @ApiOperation({
    summary: 'Correct a mark that a teacher holds (exam cell only, with a reason)',
  })
  async correct(@Body() dto: CreateMarkDto & CorrectMarkDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub, {
      isCorrection: true,
      reason: dto.reason,
    });
  }

  @Get()
  @AnyPermission('marks:read', 'marks:enter_own_subject')
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
    /**
     * The scope is resolved from the caller, not from the query. A teacher
     * asking for the whole branch's marks receives only the subjects they
     * were allocated.
     */
    const scope = await this.scope.resolveMarkScope(user.sub, {
      branchId: parseOptionalString(branchId),
      academicYearId: parseOptionalString(academicYearId),
      subjectOfferingId: parseOptionalString(subjectOfferingId),
    });

    return this.service.findAll({
      studentId: parseOptionalString(studentId),
      subjectId: parseOptionalString(subjectId),
      subjectOfferingId: scope.subjectOfferingId,
      examType: parseOptionalString(examType),
      academicYearId: parseOptionalString(academicYearId),
      branchId: scope.branchId,
    });
  }

  // Static segments are declared before `@Get(':id')` so the literal paths win
  // over the parameter route.
  @Get('calculate/class')
  @AnyPermission('marks:read', 'marks:enter_own_subject')
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
    const semesterNumber = parseOptionalInt(semester);
    if (semesterNumber === undefined) {
      throw new NotFoundException('Choose the semester to calculate.');
    }

    /**
     * The class must be one the caller may see: their own class, or a class
     * they teach, or a class in their branch if they hold a branch-wide
     * read right.
     */
    await this.scope.assertMayReadClass(user.sub, {
      branchId,
      semester: semesterNumber,
      schemeId,
      academicYearId,
    });

    return this.service.calculateClassResult({
      branchId,
      schemeId,
      semester: semesterNumber,
      academicYearId,
    });
  }

  @Get('calculate/:studentId')
  @AnyPermission('marks:read', 'marks:enter_own_subject')
  @ApiOperation({
    summary: 'Calculate student result using scheme-aware calculator (2019/2022/2024)',
  })
  async calculate(
    @CurrentUser() user: JwtPayload,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string
  ) {
    await this.scope.assertMayReadStudent(user.sub, studentId, academicYearId);

    return this.service.calculateStudentResult(studentId, academicYearId);
  }

  @Get(':id')
  @AnyPermission('marks:read', 'marks:enter_own_subject')
  async findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.scope.assertMayReadMark(user.sub, id);

    return this.service.findById(id);
  }

  @Put(':id')
  @AnyPermission('marks:enter_own_subject', 'marks:write')
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
  @AnyPermission('marks:enter_own_subject', 'marks:write')
  @Audited(AuditResource.MARK, AuditAction.DELETE, { resourceIdSource: 'param' })
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    return this.service.delete(id, user.sub);
  }
}
