import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * The body of a request to archive a report.
 *
 * A reason is required. Archiving a report is a consequential act — it
 * removes a statement about a class's results from the list — and the
 * reason is what makes it explainable to whoever looks at the audit trail
 * later.
 */
export class ArchiveReportDto {
  @ApiProperty({
    description: 'Why the report is being archived.',
    example: 'The report was generated for the wrong semester.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Give a reason for archiving this report.' })
  @MinLength(10, {
    message: 'Please write a little more, so this can be explained later.',
  })
  @MaxLength(500)
  reason!: string;
}
