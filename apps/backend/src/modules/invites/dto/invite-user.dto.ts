import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { INVITABLE_ROLES } from '@/common/constants/roles';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

/**
 * The set of roles an administrator may grant through an invitation.
 *
 * `SUPER_ADMIN` is intentionally absent — a Super Admin must not be able to
 * mint a second Super Admin through the invite flow.
 */
export const ASSIGNABLE_INVITE_ROLES = INVITABLE_ROLES as readonly string[];

export class InviteUserDto {
  @ApiProperty({ example: 'teacher@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jane Doe', minLength: 2, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'TEACHER',
    enum: ASSIGNABLE_INVITE_ROLES,
    description: 'Role to assign on acceptance. SUPER_ADMIN cannot be granted via invite.',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(ASSIGNABLE_INVITE_ROLES, {
    message: `roleName must be one of: ${ASSIGNABLE_INVITE_ROLES.join(', ')}`,
  })
  roleName: string;

  @ApiProperty({
    required: false,
    description: 'Branch scope for branch-scoped roles (HOD, PRINCIPAL, TEACHER).',
  })
  @IsOptional()
  @IsEntityId()
  branchId?: string;
}
