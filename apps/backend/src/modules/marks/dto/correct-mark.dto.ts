import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The reason an exam-cell member gave for correcting a teacher's mark.
 *
 * A correction overwrites work another person is responsible for, so it is
 * not a silent operation: the reason is recorded in the audit trail and
 * shown to anyone who later asks who changed a published score and why.
 */
export class CorrectMarkDto {
  @ApiProperty({
    example: 'Re-tallied after the moderation meeting on 12 October.',
    description: 'Why the mark is being corrected.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Give a reason for the correction.' })
  @MaxLength(500, { message: 'Keep the reason under 500 characters.' })
  reason: string;
}
