import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Why a member's access is being revoked.
 *
 * A revocation ends someone's access to the college's results. It is audited,
 * and the reason is the first thing anybody will ask for when the decision is
 * questioned later — so it is required, not optional.
 */
export class RevokeMemberDto {
  @ApiProperty({
    example: 'Left the college on 30 September. Teaching allocations released.',
    description: 'Why this member is being revoked.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Give a reason for revoking this member.' })
  @MaxLength(500, { message: 'Keep the reason under 500 characters.' })
  reason: string;
}
