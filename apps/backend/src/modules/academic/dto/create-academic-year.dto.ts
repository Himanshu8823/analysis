import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * The body of a request to create an academic year.
 *
 * An academic year is named the way a college names it — "2024-25" — and
 * carries the dates it runs between. The dates are what the system uses to
 * work out which year is running today, so they are required.
 */
export class CreateAcademicYearDto {
  @ApiProperty({ description: 'The year, in the college’s own form.', example: '2024-25' })
  @IsString()
  @MinLength(3, { message: 'Write the year in the form 2024-25.' })
  @MaxLength(20)
  @Matches(/^\d{4}\s*[-–/]\s*\d{2,4}$/, {
    message: 'Write the year in the form 2024-25.',
  })
  year!: string;

  @ApiProperty({ description: 'The first day of the year.', example: '2024-06-01' })
  @IsDateString({}, { message: 'Give the date the year starts, as YYYY-MM-DD.' })
  startDate!: string;

  @ApiProperty({ description: 'The last day of the year.', example: '2025-05-31' })
  @IsDateString({}, { message: 'Give the date the year ends, as YYYY-MM-DD.' })
  endDate!: string;

  @ApiProperty({
    required: false,
    description:
      'Whether this is the year the college is currently running. Only one year may be active.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
