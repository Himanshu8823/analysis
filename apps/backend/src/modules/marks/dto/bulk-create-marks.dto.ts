import { IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateMarkDto } from './create-mark.dto';

export class BulkCreateMarksDto {
  @ApiProperty({ type: [CreateMarkDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateMarkDto)
  marks: CreateMarkDto[];
}
