import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RevokeRoleDto {
  @ApiProperty()
  @IsUUID('4')
  userId: string;

  @ApiProperty({ example: 'TEACHER' })
  @IsString()
  @IsNotEmpty()
  roleName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;
}