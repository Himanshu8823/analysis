import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsBoolean,
  IsOptional,
  IsArray,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * One assessment component of a subject — CA1, CA2, MID_SEM, WRITTEN and so on.
 *
 * The component breakdown is the template the teacher fills in: it says what
 * each part is worth, not what any student scored.
 */
export class SubjectComponentDto {
  @ApiProperty({ example: 'CA1' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 20 })
  @IsInt()
  @Min(0)
  maxMarks: number;

  @ApiProperty({ required: false, example: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  passingMarks?: number;

  @ApiProperty({ required: false, example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  weightage?: number;
}

/**
 * Creates a subject's identity.
 *
 * The subject carries only what makes it a subject — its code, name, credits
 * and the marks template. Which branch, semester and scheme it is taught in
 * is a separate record (`SubjectOffering`), because the same subject is
 * offered in more than one semester.
 */
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
    example: [
      { type: 'CA1', maxMarks: 20 },
      { type: 'CA2', maxMarks: 20 },
      { type: 'MID_SEM', maxMarks: 20 },
      { type: 'WRITTEN', maxMarks: 40 },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectComponentDto)
  components?: SubjectComponentDto[];

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
