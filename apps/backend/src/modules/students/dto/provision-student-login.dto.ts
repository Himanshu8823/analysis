import { IsEmail, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The body of a student-login provisioning request.
 *
 * The email is optional. When the student record already carries an
 * address, a supplied one must match it. When the record has none, the
 * supplied address is written to it — that is how a student added without
 * an email gets one.
 */
export class ProvisionStudentLoginDto {
  @ApiProperty({
    required: false,
    example: 'student@example.com',
    description:
      'The address to provision against. Must match the email already on the student record when there is one; when there is not, it is written to the record.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
