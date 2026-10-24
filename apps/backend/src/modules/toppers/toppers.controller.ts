import {
  Controller, Get, Post, Body, Query, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ToppersService } from './toppers.service';
import { normaliseRankingRule } from './algorithms';
import { Roles, Permissions } from '@/common/decorators';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

export class ClassToppersQueryDto {
  @IsEntityId()
  branchId: string;

  @IsEntityId()
  schemeId: string;

  @IsInt()
  @Type(() => Number)
  semester: number;

  @IsEntityId()
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
  @Permissions('toppers:read')
  @ApiOperation({ summary: 'Get subject-wise toppers (raw aggregate mode)' })
  async subject(
    @Query('academicYearId') academicYearId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
  ) {
    return this.service.findSubjectToppers({
      academicYearId: parseOptionalString(academicYearId),
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    });
  }

  @Get('subject-wise')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'TEACHER', 'PRINCIPAL')
  @Permissions('toppers:read')
  @ApiOperation({
    summary:
      'Per-subject toppers with tie handling for a branch+scheme+semester',
  })
  async subjectWise(
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.findSubjectWiseToppers({
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
      academicYearId: parseOptionalString(academicYearId),
    });
  }

  @Post('subject-wise')
  @Roles('SUPER_ADMIN', 'ADMIN', 'HOD', 'TEACHER', 'PRINCIPAL')
  @Permissions('toppers:read')
  @ApiOperation({
    summary:
      'Per-subject toppers with tie handling for a branch+scheme+semester',
  })
  async subjectWiseWithBody(
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
  @Permissions('toppers:read')
  @ApiOperation({ summary: 'Get class toppers (overall ranking)' })
  async class(
    @Query('academicYearId') academicYearId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
    @Query('limit') limit?: string,
    @Query('rankingRule') rankingRule?: string,
  ) {
    const params = {
      academicYearId: parseOptionalString(academicYearId),
      branchId: parseOptionalString(branchId),
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
      limit: parseOptionalInt(limit),
    };

    // A ranking rule needs the full class context, so it is served by the
    // strategy-based endpoint rather than the aggregate one.
    const rule = parseOptionalString(rankingRule);
    if (rule) {
      const normalised = normaliseRankingRule(rule);
      if (!normalised) {
        throw new BadRequestException(
          `Unsupported ranking rule "${rule}". Use one of: ${this.service.listSupportedRules().join(', ')}.`,
        );
      }
      return this.service.findClassToppersByRule(
        {
          branchId: params.branchId ?? '',
          schemeId: params.schemeId ?? '',
          semester: params.semester ?? 0,
          academicYearId: params.academicYearId ?? '',
        },
        normalised,
        params.limit,
      );
    }

    return this.service.findClassToppers(params);
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
