import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'teacher@dbatu.edu' })
  @IsEmail()
  email: string;
}
