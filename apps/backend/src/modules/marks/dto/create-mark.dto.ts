import {
  IsString, IsNotEmpty, IsNumber, IsUUID, IsBoolean, IsOptional, Min, IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const EXAM_TYPES = ['CA1', 'CA2', 'MID_SEM', 'WRITTEN', 'PRACTICAL', 'ORAL'] as const;

export class CreateMarkDto {
  @ApiProperty()
  @IsUUID('4')
  studentId: string;

  @ApiProperty()
  @IsUUID('4')
  subjectId: string;

  @ApiProperty({ enum: EXAM_TYPES })
  @IsString()
  @IsIn(EXAM_TYPES as unknown as string[])
  examType: string;

  @ApiProperty({ example: 78 })
  @IsNumber()
  @Min(0)
  marksObtained: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  maxMarks: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isWithheld?: boolean;

  @ApiProperty()
  @IsUUID('4')
  academicYearId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remarks?: string;
}