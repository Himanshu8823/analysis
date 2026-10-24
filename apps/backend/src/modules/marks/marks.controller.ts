import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MarksService } from './marks.service';
import { CreateMarkDto, BulkCreateMarksDto, UpdateMarkDto } from './dto';
import { Roles, Permissions, CurrentUser } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

@ApiTags('Marks')
@ApiBearerAuth()
@Controller('marks')
export class MarksController {
  constructor(private readonly service: MarksService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @Permissions('marks:write')
  @ApiOperation({ summary: 'Create or upsert a single mark entry' })
  async create(@Body() dto: CreateMarkDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Post('bulk')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('marks:write')
  @ApiOperation({ summary: 'Bulk upsert marks (e.g. spreadsheet import)' })
  async createBulk(@Body() dto: BulkCreateMarksDto, @CurrentUser() user: JwtPayload) {
    return this.service.createBulk(dto, user.sub);
  }

  @Get()
  @Permissions('marks:read')
  @ApiOperation({ summary: 'List marks with optional filters' })
  async findAll(
    @Query('studentId') studentId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('examType') examType?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.findAll({
      studentId: parseOptionalString(studentId),
      subjectId: parseOptionalString(subjectId),
      examType: parseOptionalString(examType),
      academicYearId: parseOptionalString(academicYearId),
    });
  }

  // Static segments are declared before `@Get(':id')` so the literal paths win
  // over the parameter route.
  @Get('calculate/class')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD')
  @Permissions('marks:read')
  @ApiOperation({
    summary:
      'Calculate every student in a class (branch+scheme+semester+academicYear)',
  })
  async calculateClass(
    @Query('branchId') branchId: string,
    @Query('schemeId') schemeId: string,
    @Query('semester') semester: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.calculateClassResult({
      branchId,
      schemeId,
      semester: parseOptionalInt(semester),
      academicYearId,
    });
  }

  @Get('calculate/:studentId')
  @Permissions('marks:read')
  @ApiOperation({
    summary:
      'Calculate student result using scheme-aware calculator (2019/2022/2024)',
  })
  async calculate(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.calculateStudentResult(studentId, academicYearId);
  }

  @Get(':id')
  @Permissions('marks:read')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'TEACHER')
  @Permissions('marks:write')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMarkDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('marks:write')
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}
