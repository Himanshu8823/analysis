import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '@/common/decorators';
import type { JwtPayload } from '@/common/types';
import { ProvisionStudentLoginDto } from './dto/provision-student-login.dto';
import { BulkProvisionStudentsDto } from './dto/bulk-provision-students.dto';
import { StudentProvisioningService } from './student-provisioning.service';
import { StudentBulkProvisioningService } from './student-bulk-provisioning.service';

/**
 * The examination cell's endpoint for turning a student record into a login.
 *
 * It is separate from the roster endpoints because it creates an account —
 * a materially different action from reading or editing the academic
 * record, and one the audit trail wants to see on its own.
 */
@ApiTags('Students')
@ApiBearerAuth()
@Controller('students')
export class StudentProvisioningController {
  constructor(
    private readonly provisioningService: StudentProvisioningService,
    private readonly bulkProvisioningService: StudentBulkProvisioningService
  ) {}

  /**
   * Provisions (or links) a login account for a student record.
   *
   * When the record has an email and no account exists yet, one is created
   * with the STUDENT role, `mustChangePassword: true` and a random
   * temporary password. The temporary password is returned in the response
   * exactly once — it is never stored in plaintext and never emailed, so
   * the exam cell has to read it out to the student.
   *
   * When an account with that email already exists it is simply linked and
   * no password is returned.
   */
  @Post(':studentId/provision-login')
  @Permissions('students:write')
  // The provisioning service records this route itself — it knows whether the
  // account was created or merely linked, which the route cannot tell. Adding
  // `@Audited` here would write a second, less precise row.
  @ApiOperation({
    summary: 'Provision a login account for a student record',
    description:
      'Creates a STUDENT-role account with a temporary password when none exists, ' +
      'or links the existing account for that email. The temporary password is ' +
      'returned once and never emailed.',
  })
  async provisionLogin(
    @Param('studentId') studentId: string,
    @Body() dto: ProvisionStudentLoginDto,
    @CurrentUser() user: JwtPayload
  ) {
    return this.provisioningService.provision(studentId, user.sub, {
      email: dto?.email,
    });
  }

  /**
   * Provisions logins for a whole class, or for a selected set of students.
   *
   * The run reuses the single-student provisioning path for every student,
   * so an account created here is identical to one created by the
   * single-student route — same role, same temporary-password rules, same
   * audit row.
   *
   * The response reports what happened per student, so a run that covers a
   * hundred students and fails on two says which two and why, instead of
   * reporting a bare failure.
   */
  @Post('bulk-provision-logins')
  @Permissions('students:bulk_provision')
  // The bulk service records the run itself — it knows the per-student
  // outcome, which the route cannot tell. Adding `@Audited` here would
  // write a second, less precise row.
  @ApiOperation({
    summary: 'Provision login accounts for a whole class or a selected set',
    description:
      'Names either a class (branch, semester, scheme and academic year) or a ' +
      'list of student ids — not both. The temporary passwords are returned ' +
      'once and are never emailed.',
  })
  async bulkProvisionLogins(
    @Body() dto: BulkProvisionStudentsDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ) {
    return this.bulkProvisioningService.provision(
      {
        branchId: dto.branchId,
        semester: dto.semester,
        schemeId: dto.schemeId,
        academicYearId: dto.academicYearId,
        studentIds: dto.studentIds,
        skipMissingEmail: dto.skipMissingEmail,
      },
      user.sub,
      {
        ip: request.ip,
        userAgent: headerValue(request.headers?.['user-agent']),
      }
    );
  }
}

/**
 * Reads a header that may arrive as a string or as an array of strings.
 */
function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
