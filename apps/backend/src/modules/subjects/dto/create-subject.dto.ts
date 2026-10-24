import {
  IsString, IsNotEmpty, IsInt, IsUUID, IsBoolean, IsOptional, IsArray, Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

interface SubjectComponent {
  type: string;
  maxMarks: number;
  passingMarks?: number;
  weightage?: number;
}

export class CreateSubjectDto {
  @ApiProperty({ example: 'CS301' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Data Structures' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  credits: number;

  @ApiProperty()
  @IsUUID('4')
  branchId: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  semester: number;

  @ApiProperty()
  @IsUUID('4')
  schemeId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  year: number;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  maxMarks: number;

  @ApiProperty({ example: 40 })
  @IsInt()
  @Min(0)
  passingMarks: number;

  @ApiProperty({
    required: false,
    example: [{ type: 'CA1', maxMarks: 20 }, { type: 'WRITTEN', maxMarks: 80 }],
  })
  @IsOptional()
  @IsArray()
  components?: SubjectComponent[];

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}