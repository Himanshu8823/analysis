import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The member's own editable profile fields.
 *
 * The email is deliberately absent: it identifies the account and is the
 * login, so it is never changed from the profile screen. Only an
 * administrator can change it, and that happens through the member
 * management flow rather than here.
 */
export class UpdateProfileDto {
  @ApiProperty({ example: 'Jane Doe', minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
}
