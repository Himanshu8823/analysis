import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRoleDto {
  @ApiProperty()
  @IsUUID('4')
  userId: string;

  @ApiProperty({ example: 'TEACHER' })
  @IsString()
  @IsNotEmpty()
  roleName: string;

  @ApiProperty({ required: false, description: 'Optional branch scope (for HOD/Teacher)' })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;
}