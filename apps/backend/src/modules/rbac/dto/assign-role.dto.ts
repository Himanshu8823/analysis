import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

export class AssignRoleDto {
  @ApiProperty()
  @IsEntityId()
  userId: string;

  @ApiProperty({ example: 'TEACHER' })
  @IsString()
  @IsNotEmpty()
  roleName: string;

  @ApiProperty({ required: false, description: 'Optional branch scope (for HOD/Teacher)' })
  @IsOptional()
  @IsEntityId()
  branchId?: string;
}
