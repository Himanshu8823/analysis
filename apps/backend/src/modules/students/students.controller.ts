import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto, BulkImportStudentsDto } from './dto';
import { parseStudentFile } from './student-import.parser';
import { Permissions, CurrentUser, Audited, AuditAction, AuditResource } from '@/common/decorators';
import { ScopeService } from '@/common/services/scope.service';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

/** The upload limit the importer enforces — 5 MB, 5 000 rows. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@ApiTags('Students')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(
    private readonly service: StudentsService,
    private readonly scope: ScopeService
  ) {}

  @Post()
  @Permissions('students:write')
  @Audited(AuditResource.STUDENT, AuditAction.CREATE, {
    resourceIdSource: 'response',
    detailsFromBody: { rollNo: 'rollNo', semester: 'semester', branchId: 'branchId' },
  })
  @ApiOperation({ summary: 'Create student' })
  async create(@Body() dto: CreateStudentDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @Permissions('students:read')
  @ApiOperation({ summary: 'List students (paginated)' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('currentYear') currentYear?: string,
    @Query('semester') semester?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('search') search?: string
  ) {
    // A branch-scoped user only ever sees their own branches; asking for a
    // different one is rejected rather than silently overridden.
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.findAll({
      page: parseOptionalInt(page),
      pageSize: parseOptionalInt(pageSize),
      branchId: effectiveBranchIds,
      schemeId: parseOptionalString(schemeId),
      currentYear: parseOptionalInt(currentYear),
      semester: parseOptionalInt(semester),
      academicYearId: parseOptionalString(academicYearId),
      search: parseOptionalString(search),
    });
  }

  /**
   * Declared before `@Get(':id')` so the literal path wins over the
   * parameter route.
   */
  @Post('bulk-import')
  @Permissions('students:write')
  @Audited(AuditResource.STUDENT, AuditAction.BULK_IMPORT, {
    resourceIdSource: 'none',
  })
  @ApiOperation({ summary: 'Bulk import students from JSON rows' })
  async bulkImport(@Body() dto: BulkImportStudentsDto) {
    return this.service.bulkImport(dto);
  }

  @Post('bulk-import/file')
  @Permissions('students:write')
  @Audited(AuditResource.STUDENT, AuditAction.BULK_IMPORT, {
    resourceIdSource: 'none',
  })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk import students from a CSV or Excel file' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async bulkImportFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('batchId') batchId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('currentYear') currentYear?: string,
    @Query('semester') semester?: string
  ) {
    if (!file) {
      throw new BadRequestException('A CSV or Excel file is required');
    }
    const parsed = await parseStudentFile(file.buffer, file.originalname);
    return this.service.bulkImportFile(
      parsed.rows,
      {
        branchId: parseOptionalString(branchId),
        schemeId: parseOptionalString(schemeId),
        batchId: parseOptionalString(batchId),
        academicYearId: parseOptionalString(academicYearId),
        currentYear: parseOptionalInt(currentYear),
        semester: parseOptionalInt(semester),
      },
      parsed.errors
    );
  }

  /**
   * The owner-scoped roster read.
   *
   * A student account holds `students:read_own`, never `students:read`, so
   * the general listing above is unreachable for them. This endpoint is the
   * owner-scoped counterpart: it returns the caller's own student record and
   * nothing else, whatever filters are supplied.
   *
   * Declared before `@Get(':id')` so the literal path wins over the
   * parameter route.
   */
  @Get('own')
  @Permissions('students:read_own')
  @ApiOperation({ summary: 'Get my own student record' })
  async findOwn(@CurrentUser() user: JwtPayload) {
    return this.service.findOwn(user.sub);
  }

  /**
   * The owner-scoped read of a single student record.
   *
   * The requested id has to belong to the caller — anything else is a 403.
   */
  @Get('own/:studentId')
  @Permissions('students:read_own')
  @ApiOperation({ summary: 'Get one of my own student records' })
  async findOneOwn(@CurrentUser() user: JwtPayload, @Param('studentId') studentId: string) {
    return this.service.findOneOwn(user.sub, studentId);
  }

  @Get(':id')
  @Permissions('students:read')
  async findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    // The single-student read is scoped too — otherwise it is a way around
    // the branch filter applied to the listing above.
    const student = await this.service.findById(id);
    await this.scope.resolveBranchScope(user.sub, student.branchId);
    return student;
  }

  @Put(':id')
  @Permissions('students:write')
  @Audited(AuditResource.STUDENT, AuditAction.UPDATE, {
    resourceIdSource: 'param',
    detailsFromBody: { rollNo: 'rollNo', semester: 'semester' },
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Permissions('students:write')
  @Audited(AuditResource.STUDENT, AuditAction.DELETE, { resourceIdSource: 'param' })
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    return this.service.delete(id, user.sub);
  }
}
