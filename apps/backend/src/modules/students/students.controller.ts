import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto } from './dto';
import { Roles, Permissions, CurrentUser } from '@/common/decorators';
import type { JwtPayload } from '@/common/types';

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
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('currentYear') currentYear?: number,
    @Query('semester') semester?: number,
    @Query('academicYearId') academicYearId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({
      page,
      pageSize,
      branchId,
      schemeId,
      currentYear: currentYear !== undefined ? Number(currentYear) : undefined,
      semester: semester !== undefined ? Number(semester) : undefined,
      academicYearId,
      search,
    });
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