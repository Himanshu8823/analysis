import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto';
import { Roles, Permissions } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';

@ApiTags('Subjects')
@ApiBearerAuth()
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly service: SubjectsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('subjects:write')
  @ApiOperation({ summary: 'Create subject' })
  async create(@Body() dto: CreateSubjectDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('subjects:read')
  async findAll(
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service.findAll({
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Get(':id')
  @Permissions('subjects:read')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('subjects:write')
  async update(@Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @Permissions('subjects:delete')
  async delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}