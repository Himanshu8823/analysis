import {
  Controller, Get, Post, Body, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ToppersService } from './toppers.service';
import { Roles, Permissions } from '@/common/decorators';

export class ClassToppersQueryDto {
  @IsUUID('4')
  branchId: string;

  @IsUUID('4')
  schemeId: string;

  @IsInt()
  @Type(() => Number)
  semester: number;

  @IsUUID('4')
  academicYearId: string;

  @IsOptional()
  @IsString()
  @IsIn(['percentage', 'credits', 'marks'])
  rule?: 'percentage' | 'credits' | 'marks';

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}

@ApiTags('Toppers')
@ApiBearerAuth()
@Controller('toppers')
export class ToppersController {
  constructor(private readonly service: ToppersService) {}

  @Get('subject')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'TEACHER', 'PRINCIPAL')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Get subject-wise toppers (raw aggregate mode)' })
  async subject(
    @Query('academicYearId') academicYearId: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: number,
  ) {
    return this.service.findSubjectToppers({
      academicYearId,
      branchId,
      schemeId,
      semester: semester !== undefined ? Number(semester) : undefined,
    });
  }

  @Post('subject-wise')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'TEACHER', 'PRINCIPAL')
  @Permissions('analytics:read')
  @ApiOperation({
    summary:
      'Per-subject toppers with tie handling for a branch+scheme+semester',
  })
  async subjectWise(
    @Body() body: ClassToppersQueryDto,
  ) {
    return this.service.findSubjectWiseToppers({
      branchId: body.branchId,
      schemeId: body.schemeId,
      semester: Number(body.semester),
      academicYearId: body.academicYearId,
    });
  }

  @Get('class')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'PRINCIPAL')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'Get class toppers (overall ranking)' })
  async class(
    @Query('academicYearId') academicYearId: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findClassToppers({
      academicYearId,
      branchId,
      schemeId,
      semester: semester !== undefined ? Number(semester) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  @Post('class')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'PRINCIPAL')
  @Permissions('analytics:read')
  @ApiOperation({
    summary:
      'Class leaderboard with explicit ranking rule (percentage|credits|marks)',
  })
  async classWithRule(@Body() body: ClassToppersQueryDto) {
    return this.service.findClassToppersByRule(
      {
        branchId: body.branchId,
        schemeId: body.schemeId,
        semester: Number(body.semester),
        academicYearId: body.academicYearId,
      },
      body.rule ?? 'percentage',
      body.limit,
    );
  }

  @Get('rules')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'List available ranking rules' })
  async rules() {
    return { rules: this.service.listSupportedRules() };
  }
}
