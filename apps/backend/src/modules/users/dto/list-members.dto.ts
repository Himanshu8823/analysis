import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ListMembersDto {
  @ApiProperty({ required: false, description: 'Match against the member name or email.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, example: 'TEACHER', description: 'Filter by assigned role.' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ required: false, description: 'Filter by branch id.' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
