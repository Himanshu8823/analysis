import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AcademicService } from './academic.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { Permissions, Audited, AuditAction, AuditResource } from '@/common/decorators';
import { parseOptionalString } from '@/common/utils/query-params';

@ApiTags('Academic')
@ApiBearerAuth()
@Controller('academic')
export class AcademicController {
  constructor(private readonly service: AcademicService) {}

  @Get('years')
  @Permissions('students:read')
  @ApiOperation({ summary: 'List academic years (active one first)' })
  async years() {
    return this.service.findAllYears();
  }

  @Get('years/:id')
  @Permissions('students:read')
  @ApiOperation({ summary: 'Get a single academic year' })
  async year(@Param('id') id: string) {
    return this.service.findYearById(id);
  }

  /**
   * Creates an academic year.
   *
   * An academic year is what every result, subject offering and allocation
   * is grouped by, so a college has to be able to add one without a
   * developer. The year carries the dates it runs between, because the
   * system works out which year is running today from them.
   */
  @Post('years')
  @Permissions('academic_years:write')
  @Audited(AuditResource.ACADEMIC_YEAR, AuditAction.CREATE, {
    resourceIdSource: 'response',
    detailsFromBody: { year: 'year', startDate: 'startDate', endDate: 'endDate' },
  })
  @ApiOperation({ summary: 'Create an academic year' })
  async createYear(@Body() dto: CreateAcademicYearDto) {
    return this.service.createYear(dto);
  }

  /**
   * Makes an academic year the running one.
   *
   * Every screen defaults to the running year, so changing it is a
   * college-wide act — which is why it is a separate, audited action rather
   * than an edit to the year.
   */
  @Post('years/:id/activate')
  @Permissions('academic_years:write')
  @Audited(AuditResource.ACADEMIC_YEAR, AuditAction.UPDATE, {
    resourceIdSource: 'param',
  })
  @ApiOperation({ summary: 'Make an academic year the running one' })
  async activateYear(@Param('id') id: string) {
    return this.service.activateYear(id);
  }

  @Get('batches')
  @Permissions('students:read')
  @ApiOperation({ summary: 'List batches, optionally filtered by admission year' })
  async batches(@Query('admissionYearId') admissionYearId?: string) {
    return this.service.findAllBatches(parseOptionalString(admissionYearId));
  }
}
