import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsISO8601, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSchemeDto {
  @ApiProperty({ example: 'SCHEME_2024' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'DBATU 2024 scheme for all branches' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Scheme rules JSON (passingPercentage, graceMarks, components)',
    example: { passingPercentage: 40, graceMarks: 5, components: [] },
  })
  @IsObject()
  rules: Record<string, unknown>;

  @ApiProperty({ example: '2024-08-01' })
  @IsISO8601()
  effectiveFrom: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
