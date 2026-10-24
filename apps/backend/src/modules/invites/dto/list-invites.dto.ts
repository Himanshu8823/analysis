import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ListInvitesDto {
  @ApiProperty({ required: false, enum: ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'] })
  @IsOptional()
  @IsEnum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'])
  status?: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

  @ApiProperty({ required: false, description: 'Match against the invitee email or name.' })
  @IsOptional()
  @IsString()
  search?: string;

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
