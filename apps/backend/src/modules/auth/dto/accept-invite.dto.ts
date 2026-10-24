import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_PATTERN, PASSWORD_POLICY_MESSAGE } from '../../users/dto/create-user.dto';

export class AcceptInviteDto {
  @ApiProperty({
    description: 'The one-time token from the invitation email.',
    minLength: 32,
  })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token: string;

  @ApiProperty({
    example: 'StrongPass123!',
    minLength: 8,
    maxLength: 72,
    description: 'The password the invitee chooses for their account.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_POLICY_MESSAGE })
  password: string;
}
