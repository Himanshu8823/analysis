import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UploadedFile, UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import {
  CreateStudentDto, UpdateStudentDto, BulkImportStudentsDto,
} from './dto';
import { parseStudentFile } from './student-import.parser';
import { Roles, Permissions, CurrentUser } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

/** The upload limit the importer enforces — 5 MB, 5 000 rows. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@ApiTags('Students')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('students:write')
  @ApiOperation({ summary: 'Create student' })
  async create(@Body() dto: CreateStudentDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @Permissions('students:read')
  @ApiOperation({ summary: 'List students (paginated)' })
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('currentYear') currentYear?: string,
    @Query('semester') semester?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({
      page: parseOptionalInt(page),
      pageSize: parseOptionalInt(pageSize),
      branchId: parseOptionalString(branchId),
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
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('students:write')
  @ApiOperation({ summary: 'Bulk import students from JSON rows' })
  async bulkImport(@Body() dto: BulkImportStudentsDto) {
    return this.service.bulkImport(dto);
  }

  @Post('bulk-import/file')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('students:write')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk import students from a CSV or Excel file' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  async bulkImportFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('batchId') batchId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('currentYear') currentYear?: string,
    @Query('semester') semester?: string,
  ) {
    if (!file) {
      throw new BadRequestException('A CSV or Excel file is required');
    }
    const parsed = await parseStudentFile(file.buffer, file.originalname);
    return this.service.bulkImportFile(parsed.rows, {
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      batchId: parseOptionalString(batchId),
      academicYearId: parseOptionalString(academicYearId),
      currentYear: parseOptionalInt(currentYear),
      semester: parseOptionalInt(semester),
    }, parsed.errors);
  }

  @Get(':id')
  @Permissions('students:read')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('students:write')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('students:write')
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    return this.service.delete(id, user.sub);
  }
}
