import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Permissions } from '@/common/decorators';
import type { JwtPayload } from '@/common/types';
import { ProvisionStudentLoginDto } from './dto/provision-student-login.dto';
import { StudentProvisioningService } from './student-provisioning.service';

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
  constructor(private readonly provisioningService: StudentProvisioningService) {}

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
}
