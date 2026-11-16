import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuthorisationService } from '@/common/services/authorisation.service';
import { AuditService } from '@/common/services/audit.service';
import { AuditAction, AuditResource } from '@/common/decorators/audited.decorator';
import { StudentProvisioningService } from './student-provisioning.service';
import type { BulkProvisionResult } from './dto/bulk-provision-students.dto';

/**
 * The permission that guards a bulk provisioning run.
 *
 * It is separate from `students:write` because a bulk run creates a whole
 * class's worth of accounts at once — a materially larger act than editing
 * one record, and one that deserves its own right.
 */
export const BULK_PROVISION_PERMISSION = 'students:bulk_provision';

/**
 * The maximum number of students one run may provision.
 *
 * A class is bounded in practice — a hundred and fifty students at the
 * largest — so this is generous. It is here to stop a mistyped request
 * from trying to provision every student in the college in one go.
 */
export const MAX_BULK_PROVISION = 500;

/**
 * The bulk login-provisioning service.
 *
 * It is a *wrapper*, not a second mechanism: every account it creates goes
 * through {@link StudentProvisioningService.provision}, which is the single
 * path that knows how to create a student account, link an existing one,
 * hash a temporary password, assign the STUDENT role and record the audit
 * row. A second implementation would be a second set of bugs.
 *
 * What this service adds is the *selection* — turning "this class" or
 * "these twelve students" into a list of student records — and the
 * *reporting*, so a run that provisions ninety accounts and fails on ten
 * tells the clerk exactly which ten and why.
 */
@Injectable()
export class StudentBulkProvisioningService {
  private readonly logger = new Logger(StudentBulkProvisioningService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly provisioning: StudentProvisioningService,
    private readonly authorisation: AuthorisationService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Provisions logins for a whole class, or for a selected set of students.
   *
   * The scope is either a class (branch + semester + scheme + academic
   * year) or an explicit list of student ids. The two are mutually
   * exclusive: accepting both at once would leave the clerk guessing which
   * instruction the system took.
   */
  async provision(
    scope: {
      branchId?: string;
      semester?: number;
      schemeId?: string;
      academicYearId?: string;
      studentIds?: string[];
      skipMissingEmail?: boolean;
    },
    provisionedBy: string,
    requestContext?: { ip?: string; userAgent?: string }
  ): Promise<BulkProvisionResult> {
    /**
     * The right to provision a whole class at once.
     *
     * Checked here, in the service layer, because a decorator alone is
     * bypassable by any code path that calls the service directly.
     */
    await this.authorisation.assertAnyPermission(provisionedBy, [BULK_PROVISION_PERMISSION]);

    const hasSelection = Boolean(scope.studentIds?.length);
    const hasClassScope = Boolean(scope.branchId && scope.semester && scope.schemeId);

    if (hasSelection && hasClassScope) {
      throw new BadRequestException('Choose either a class or a list of students — not both.');
    }

    if (!hasSelection && !hasClassScope) {
      throw new BadRequestException(
        'Choose the class to provision, or select the students to provision.'
      );
    }

    const students = await this.resolveStudents(scope);

    if (!students.length) {
      throw new BadRequestException('There are no students in that class to give a login to.');
    }

    if (students.length > MAX_BULK_PROVISION) {
      throw new BadRequestException(
        `A single run can provision up to ${MAX_BULK_PROVISION} students. Narrow the selection and run it again.`
      );
    }

    /**
     * Every student in the run must be in a branch the caller may write to.
     *
     * The check is over the whole set, not over the first student: a run
     * that quietly skipped the students outside the caller's branch would
     * report a success that did not cover what was asked for.
     */
    const branchIds = [...new Set(students.map((s) => s.branchId))];
    for (const branchId of branchIds) {
      await this.authorisation.assertBranchWritable(provisionedBy, branchId, 'student');
    }

    const result: BulkProvisionResult = {
      created: 0,
      linked: 0,
      skipped: 0,
      accounts: [],
      failures: [],
    };

    for (const student of students) {
      /**
       * A student with no email address cannot be given a login — the
       * account is created against an address. Whether that fails the run
       * or is reported and skipped is the caller's choice, made in the
       * request.
       */
      if (!student.email) {
        if (!scope.skipMissingEmail) {
          result.failures.push({
            studentId: student.id,
            rollNo: student.rollNo,
            reason: 'This student record has no email address, so no login could be created.',
          });
          continue;
        }
        result.skipped += 1;
        continue;
      }

      try {
        const provisioned = await this.provisioning.provision(student.id, provisionedBy, {
          email: student.email,
          ip: requestContext?.ip,
          userAgent: requestContext?.userAgent,
        });

        if (provisioned.created) {
          result.created += 1;
        } else {
          result.linked += 1;
        }

        result.accounts.push({
          studentId: provisioned.studentId,
          studentName: provisioned.studentName,
          rollNo: provisioned.rollNo,
          email: provisioned.email,
          temporaryPassword: provisioned.temporaryPassword,
        });
      } catch (err) {
        /**
         * One student failing does not fail the run.
         *
         * A class of a hundred students will contain at least one record
         * that cannot be provisioned — an address already taken by another
         * account, say. Failing the whole run on it would leave the
         * ninety-nine accounts that *were* created unrecorded, and the
         * clerk with no way to tell what happened.
         */
        result.failures.push({
          studentId: student.id,
          rollNo: student.rollNo,
          reason: readableReason(err),
        });
      }
    }

    /**
     * The run itself is audited once, in addition to the per-student rows
     * the provisioning service writes.
     *
     * The per-student rows say "this student's login was created"; this one
     * says "a run covering a hundred and two students was executed, and
     * these are the numbers". Without it, there is no way to answer "how
     * many accounts did the exam cell create last week?".
     */
    await this.auditService.record({
      userId: provisionedBy,
      action: AuditAction.BULK_IMPORT,
      resource: AuditResource.STUDENT,
      details: {
        event: 'STUDENT_BULK_PROVISIONED',
        requested: students.length,
        created: result.created,
        linked: result.linked,
        skipped: result.skipped,
        failed: result.failures.length,
        branchId: scope.branchId ?? null,
        semester: scope.semester ?? null,
        academicYearId: scope.academicYearId ?? null,
      },
      requestContext: {
        ipAddress: requestContext?.ip,
        userAgent: requestContext?.userAgent,
      },
    });

    this.logger.log(
      `Bulk provisioning: ${result.created} created, ${result.linked} linked, ` +
        `${result.skipped} skipped, ${result.failures.length} failed.`
    );

    return result;
  }

  /**
   * Resolves the students a run covers.
   *
   * A class scope finds the students of that class; an explicit list is
   * taken as given, but only for students that exist and are live.
   */
  private async resolveStudents(scope: {
    branchId?: string;
    semester?: number;
    schemeId?: string;
    academicYearId?: string;
    studentIds?: string[];
  }): Promise<
    Array<{ id: string; rollNo: string; name: string; email: string | null; branchId: string }>
  > {
    if (scope.studentIds?.length) {
      return this.prisma.student.findMany({
        where: { id: { in: scope.studentIds }, isActive: true },
        select: { id: true, rollNo: true, name: true, email: true, branchId: true },
        orderBy: { rollNo: 'asc' },
      });
    }

    return this.prisma.student.findMany({
      where: {
        isActive: true,
        branchId: scope.branchId,
        semester: scope.semester,
        schemeId: scope.schemeId,
        ...(scope.academicYearId ? { academicYearId: scope.academicYearId } : {}),
      },
      select: { id: true, rollNo: true, name: true, email: true, branchId: true },
      orderBy: { rollNo: 'asc' },
    });
  }
}

/**
 * Turns an exception into a sentence a college clerk can act on.
 *
 * The provisioning service already writes its refusals in that language;
 * anything else is a fault, and is reported as such rather than leaking a
 * Prisma error to the screen.
 */
function readableReason(err: unknown): string {
  if (err instanceof ForbiddenException) {
    return 'You do not have access to this student.';
  }
  if (err instanceof BadRequestException) {
    return err.message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'The login could not be created for this student.';
}
