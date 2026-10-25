import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ToppersService } from './toppers.service';
import { normaliseRankingRule } from './algorithms';
import { Permissions, CurrentUser } from '@/common/decorators';
import { ScopeService } from '@/common/services/scope.service';
import { parseOptionalInt, parseOptionalString } from '@/common/utils/query-params';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';
import type { JwtPayload } from '@/common/types';

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
  constructor(
    private readonly service: ToppersService,
    private readonly scope: ScopeService
  ) {}

  @Get('subject')
  @Permissions('toppers:read')
  @ApiOperation({ summary: 'Get subject-wise toppers (raw aggregate mode)' })
  async subject(
    @CurrentUser() user: JwtPayload,
    @Query('academicYearId') academicYearId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string
  ) {
    // A branch-scoped user only ever sees their own branches; asking for a
    // different one is rejected, not overridden.
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.findSubjectToppers({
      academicYearId: parseOptionalString(academicYearId),
      branchId: effectiveBranchIds,
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
    });
  }

  @Get('subject-wise')
  @Permissions('toppers:read')
  @ApiOperation({
    summary: 'Per-subject toppers with tie handling for a branch+scheme+semester',
  })
  async subjectWise(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
    @Query('academicYearId') academicYearId?: string
  ) {
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    return this.service.findSubjectWiseToppers({
      branchId: effectiveBranchIds,
      schemeId: parseOptionalString(schemeId),
      semester: parseOptionalInt(semester),
      academicYearId: parseOptionalString(academicYearId),
    });
  }

  @Post('subject-wise')
  @Permissions('toppers:read')
  @ApiOperation({
    summary: 'Per-subject toppers with tie handling for a branch+scheme+semester',
  })
  async subjectWiseWithBody(@CurrentUser() user: JwtPayload, @Body() body: ClassToppersQueryDto) {
    // The body names the branch, so the same rejection rule applies.
    const effectiveBranchIds = await this.scope.resolveBranchFilter(user.sub, body.branchId);

    return this.service.findSubjectWiseToppers({
      branchId: effectiveBranchIds,
      schemeId: body.schemeId,
      semester: Number(body.semester),
      academicYearId: body.academicYearId,
    });
  }

  @Get('class')
  @Permissions('toppers:read')
  @ApiOperation({ summary: 'Get class toppers (overall ranking)' })
  async class(
    @CurrentUser() user: JwtPayload,
    @Query('academicYearId') academicYearId?: string,
    @Query('branchId') branchId?: string,
    @Query('schemeId') schemeId?: string,
    @Query('semester') semester?: string,
    @Query('limit') limit?: string,
    @Query('rankingRule') rankingRule?: string
  ) {
    const effectiveBranchIds = await this.scope.resolveBranchFilter(
      user.sub,
      parseOptionalString(branchId)
    );

    const params = {
      academicYearId: parseOptionalString(academicYearId),
      branchId: effectiveBranchIds,
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
          `Unsupported ranking rule "${rule}". Use one of: ${this.service.listSupportedRules().join(', ')}.`
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
        params.limit
      );
    }

    return this.service.findClassToppers(params);
  }

  @Post('class')
  @Permissions('analytics:read')
  @ApiOperation({
    summary: 'Class leaderboard with explicit ranking rule (percentage|credits|marks)',
  })
  async classWithRule(@CurrentUser() user: JwtPayload, @Body() body: ClassToppersQueryDto) {
    // The body names the branch, so the same rejection rule applies.
    const effectiveBranchIds = await this.scope.resolveBranchFilter(user.sub, body.branchId);

    return this.service.findClassToppersByRule(
      {
        branchId: effectiveBranchIds ?? body.branchId,
        schemeId: body.schemeId,
        semester: Number(body.semester),
        academicYearId: body.academicYearId,
      },
      body.rule ?? 'percentage',
      body.limit
    );
  }

  @Get('rules')
  @Permissions('analytics:read')
  @ApiOperation({ summary: 'List available ranking rules' })
  async rules() {
    return { rules: this.service.listSupportedRules() };
  }
}
