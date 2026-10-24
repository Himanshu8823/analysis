import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AcademicService } from './academic.service';
import { Permissions } from '@/common/decorators';
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

  @Get('batches')
  @Permissions('students:read')
  @ApiOperation({ summary: 'List batches, optionally filtered by admission year' })
  async batches(@Query('admissionYearId') admissionYearId?: string) {
    return this.service.findAllBatches(parseOptionalString(admissionYearId));
  }
}
