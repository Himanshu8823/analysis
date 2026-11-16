import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { COURSE_TYPES, type CourseType } from '@/common/constants/scheme';

/**
 * One course, as the reviewer confirmed it.
 *
 * The reviewer's screen posts back exactly what it showed. Every field is
 * optional except the code and the name, because those two are what make a
 * row a course — and a row without them is skipped, not invented.
 */
export class ConfirmCourseDto {
  @ApiProperty({ description: 'The course code, for example COEMD112.' })
  @IsString()
  @MaxLength(50)
  courseCode!: string;

  @ApiProperty({ description: 'The name of the course.' })
  @IsString()
  @MaxLength(255)
  courseName!: string;

  @ApiProperty({ description: 'The kind of course.', enum: COURSE_TYPES, required: false })
  @IsOptional()
  @IsEnum(COURSE_TYPES as unknown as string[])
  courseType?: CourseType;

  @ApiProperty({ description: 'The semester the course is taught in.', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  semester?: number;

  @ApiProperty({ description: 'The weekly lecture hours.', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40)
  theoryHours?: number;

  @ApiProperty({ description: 'The weekly practical hours.', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40)
  practicalHours?: number;

  @ApiProperty({ description: 'The marks of the continuous assessment.', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  ca?: number;

  @ApiProperty({ description: 'The marks of the mid-semester examination.', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  mse?: number;

  @ApiProperty({ description: 'The marks of the end-semester examination.', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  ese?: number;

  @ApiProperty({ description: 'The number of credits.', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40)
  credits?: number;

  @ApiProperty({
    description: 'The alternatives a student may choose between, for a co-curricular course.',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  options?: string[];

  @ApiProperty({ description: 'The page the course was read from.', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  pageNumber?: number;
}

/**
 * The body of a request to write the reviewed courses.
 */
export class ConfirmSchemeDto {
  @ApiProperty({ description: 'The branch the scheme belongs to.' })
  @IsString()
  branchId!: string;

  @ApiProperty({ description: 'The academic year the scheme belongs to.' })
  @IsString()
  academicYearId!: string;

  @ApiProperty({ description: 'The scheme the subjects belong to.' })
  @IsString()
  schemeId!: string;

  @ApiProperty({ description: 'The courses the reviewer confirmed.', type: [ConfirmCourseDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ConfirmCourseDto)
  courses!: ConfirmCourseDto[];
}
