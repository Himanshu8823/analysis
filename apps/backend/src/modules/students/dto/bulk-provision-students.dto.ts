import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  ArrayMaxSize,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';
import { IsEntityId } from '@/common/validators/is-entity-id.validator';

/**
 * The scope of a bulk login-provisioning run.
 *
 * A class is identified the same way it is everywhere else in the system:
 * branch + semester + scheme + academic year. Naming a *selected set* of
 * students instead is supported through `studentIds`.
 *
 * The two are mutually exclusive on purpose. A run that says "these twelve
 * students" and a run that says "everyone in this class" are different
 * instructions, and accepting both at once would leave the clerk guessing
 * which one the system took.
 */
export class BulkProvisionStudentsDto {
  @ApiPropertyOptional({
    example: 'b1c2d3e4-0000-4000-8000-000000000000',
    description: 'The branch whose students are to be provisioned.',
  })
  @IsOptional()
  @IsEntityId()
  branchId?: string;

  @ApiPropertyOptional({
    example: 4,
    description: 'The semester whose students are to be provisioned.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  semester?: number;

  @ApiPropertyOptional({ description: 'The scheme the class is taught under.' })
  @IsOptional()
  @IsEntityId()
  schemeId?: string;

  @ApiPropertyOptional({
    description: 'The academic year the class belongs to.',
  })
  @IsOptional()
  @IsEntityId()
  academicYearId?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'A selected set of students to provision, instead of naming a class. ' +
      'Give either this or the class scope — not both.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayMinSize(1)
  @IsString({ each: true })
  studentIds?: string[];

  @ApiPropertyOptional({
    default: false,
    description:
      'When true, students whose record has no email address are skipped and ' +
      'reported, rather than the whole run failing.',
  })
  @IsOptional()
  @IsBoolean()
  skipMissingEmail?: boolean;
}

/**
 * The outcome of a bulk provisioning run.
 */
export interface BulkProvisionResult {
  /** How many students the run provisioned a *new* account for. */
  created: number;
  /** How many students were linked to an account that already existed. */
  linked: number;
  /** How many students were skipped — usually for having no email address. */
  skipped: number;
  /**
   * The students a new account was created for, with the temporary password.
   *
   * The password is returned exactly once, because it is never stored in
   * plaintext and never emailed. A linked student has no password here —
   * the caller does not own that account's password and must not be handed
   * one.
   */
  accounts: Array<{
    studentId: string;
    studentName: string;
    rollNo: string;
    email: string;
    temporaryPassword: string | null;
  }>;
  /** The students the run could not provision, each with a plain reason. */
  failures: Array<{ studentId: string; rollNo: string; reason: string }>;
}
