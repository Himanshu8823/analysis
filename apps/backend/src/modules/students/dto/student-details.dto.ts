import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsEmail,
  IsEnum,
  IsDateString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import {
  BloodGroup,
  FeeCategory,
  Gender,
  GuardianRelation,
  ReservedCategory,
  StudentStatus,
} from '@prisma/client';

/**
 * The writable shape of a student's real-world details.
 *
 * Every field is optional except the ones the roster needs to place the
 * student in a class. A college records what it knows: a student admitted
 * in the morning may not have a date of birth or a guardian phone until the
 * afternoon, and the record must be saveable at any point in between.
 *
 * The sensitive fields — the photo, the blood group and the national
 * identity reference — are accepted here and gated on the **write** path,
 * not on this DTO. The DTO describes what may be *stored*; whether a given
 * member may *store* it is a service-layer decision, because a DTO cannot
 * know who is asking.
 */
export class StudentDetailsDto {
  // -------------------------------------------------------------------------
  // Personal details
  // -------------------------------------------------------------------------

  @ApiPropertyOptional({ example: '2003-07-14', description: 'Date of birth.' })
  @IsOptional()
  @IsDateString({}, { message: 'The date of birth must be a valid date (YYYY-MM-DD).' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender, { message: 'Choose a gender from the list.' })
  gender?: Gender;

  // -------------------------------------------------------------------------
  // Contact details
  // -------------------------------------------------------------------------

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'aarav.alternate@example.com' })
  @IsOptional()
  @IsEmail()
  alternateEmail?: string;

  @ApiPropertyOptional({ example: '12, Shivaji Nagar' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ example: 'Nashik' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: 'Maharashtra' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @ApiPropertyOptional({ example: '422001' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;

  // -------------------------------------------------------------------------
  // Identity details — sensitive
  // -------------------------------------------------------------------------

  @ApiPropertyOptional({ description: 'The student’s photograph, as a file URL.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;

  @ApiPropertyOptional({ enum: BloodGroup })
  @IsOptional()
  @IsEnum(BloodGroup, { message: 'Choose a blood group from the list.' })
  bloodGroup?: BloodGroup;

  @ApiPropertyOptional({
    description: 'The national identity reference (Aadhaar or equivalent). Sensitive.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nationalId?: string;

  // -------------------------------------------------------------------------
  // Academic details
  // -------------------------------------------------------------------------

  @ApiPropertyOptional({
    example: 2022,
    description: 'The calendar year the student joined the course.',
  })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2200)
  admissionYear?: number;

  @ApiPropertyOptional({ example: 'A', description: 'The section (division) the student is in.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  section?: string;

  // -------------------------------------------------------------------------
  // Category and quotas
  // -------------------------------------------------------------------------

  @ApiPropertyOptional({ enum: ReservedCategory })
  @IsOptional()
  @IsEnum(ReservedCategory, { message: 'Choose a reserved category from the list.' })
  reservedCategory?: ReservedCategory;

  @ApiPropertyOptional({ enum: FeeCategory })
  @IsOptional()
  @IsEnum(FeeCategory, { message: 'Choose a fee category from the list.' })
  feeCategory?: FeeCategory;

  @ApiPropertyOptional({ description: 'Whether the student holds a scholarship.' })
  @IsOptional()
  @IsBoolean()
  scholarshipRecipient?: boolean;

  // -------------------------------------------------------------------------
  // Guardians
  // -------------------------------------------------------------------------

  @ApiPropertyOptional({ example: 'Ramesh Sharma' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  guardianName?: string;

  @ApiPropertyOptional({ enum: GuardianRelation })
  @IsOptional()
  @IsEnum(GuardianRelation, { message: 'Choose a relation from the list.' })
  guardianRelation?: GuardianRelation;

  @ApiPropertyOptional({ example: '9876500000' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  guardianPhone?: string;

  @ApiPropertyOptional({ example: 'ramesh.sharma@example.com' })
  @IsOptional()
  @IsEmail()
  guardianEmail?: string;

  @ApiPropertyOptional({ example: 'Farmer' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  guardianOccupation?: string;

  @ApiPropertyOptional({ example: 'Sunita Sharma', description: 'The second guardian.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  guardian2Name?: string;

  @ApiPropertyOptional({ enum: GuardianRelation })
  @IsOptional()
  @IsEnum(GuardianRelation, { message: 'Choose a relation from the list.' })
  guardian2Relation?: GuardianRelation;

  @ApiPropertyOptional({ example: '9876500001' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  guardian2Phone?: string;

  @ApiPropertyOptional({ example: 'sunita.sharma@example.com' })
  @IsOptional()
  @IsEmail()
  guardian2Email?: string;

  @ApiPropertyOptional({ example: 'Teacher' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  guardian2Occupation?: string;

  // -------------------------------------------------------------------------
  // Status lifecycle
  // -------------------------------------------------------------------------

  @ApiPropertyOptional({
    enum: StudentStatus,
    description: 'Where the student stands in the course.',
  })
  @IsOptional()
  @IsEnum(StudentStatus, { message: 'Choose a status from the list.' })
  status?: StudentStatus;

  @ApiPropertyOptional({
    example: 'Completed the final semester',
    description: 'Why the status was last changed.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  statusReason?: string;

  @ApiPropertyOptional({
    example: '2026-06-30',
    description: 'The day the status was last changed.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'The status date must be a valid date (YYYY-MM-DD).' })
  statusDate?: string;
}
