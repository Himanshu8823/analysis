import { ArrayUnique, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

export class AssignPermissionDto {
  @ApiProperty({ type: [String], description: 'Array of permission IDs' })
  @IsArray()
  @ArrayUnique()
  @IsEntityId({ each: true })
  permissionIds: string[];
}
