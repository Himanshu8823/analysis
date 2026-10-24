import { IsEmail, IsString, IsBoolean, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The password policy, shared by every DTO that accepts a password.
 *
 * `MaxLength(72)` is not arbitrary: bcrypt silently truncates at 72 bytes, so
 * anything beyond that is ignored. Capping the length makes the effective
 * password length match the entered length.
 */
export const PASSWORD_VALIDATORS = [
  { minLength: 8, maxLength: 72 },
  { regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, message: 'Password must contain uppercase, lowercase, number, and special character' },
] as const;

export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;

export const PASSWORD_POLICY_MESSAGE =
  'Password must contain uppercase, lowercase, number, and special character';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'Password123!', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_POLICY_MESSAGE })
  password: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
