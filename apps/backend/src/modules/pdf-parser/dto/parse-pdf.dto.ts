import { IsUrl, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ParsePdfDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  fileUrl: string;
}
