import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

export class CreateNotificationDto {
  @ApiProperty()
  @IsEntityId()
  userId: string;

  @ApiProperty({ example: 'UPLOAD_COMPLETE' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}