import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuditService } from '@/common/services/audit.service';
import { AuditAction, AuditResource } from '@/common/decorators/audited.decorator';
import { CACHE_SERVICE } from '@/common/constants/injection-tokens';
import { CacheKeys } from '../cache/cache.constants';
import type { CacheService } from '@/common/interfaces/cache.service';

/**
 * The role every provisioned student account receives.
 */
export const STUDENT_ROLE = 'STUDENT';

/**
 * The length of the generated temporary password, in characters.
 *
 * Sixteen characters drawn from an unambiguous alphabet (no `O`/`0`, no
 * `I`/`l`/`1`) — a password that is read aloud from a screen by the exam
 * cell has to be transcribable without ambiguity.
 */
const TEMP_PASSWORD_LENGTH = 16;

const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** The outcome of provisioning a student's login. */
export interface ProvisionedLogin {
  studentId: string;
  studentName: string;
  rollNo: string;
  email: string;
  /** The account that now backs this student record. */
  userId: string;
  /** `true` when a new account was created, `false` when an existing one was linked. */
  created: boolean;
  /**
   * The temporary password, returned exactly once.
   *
   * It is never persisted in plaintext and never emailed — the backend has
   * no student-email flow — so the exam cell has to read it out to the
   * student. It is `null` when an existing account was linked, because the
   * caller cannot be handed a password they do not own.
   */
  temporaryPassword: string | null;
}

@Injectable()
export class StudentProvisioningService {
  private readonly logger = new Logger(StudentProvisioningService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService
  ) {}

  private get bcryptRounds(): number {
    return this.config.get<number>('auth.bcryptRounds') ?? 12;
  }

  /**
   * Provisions a login for a student record.
   *
   * The student may already have an account (created through the invite
   * flow, say) — in that case the account is simply linked, and no password
   * is returned. When there is no account yet, one is created with a random
   * temporary password, the STUDENT role and `mustChangePassword: true`.
   *
   * The account, the role assignment and the `Student.userId` link are
   * written in one transaction: a half-provisioned student cannot log in,
   * and a linked account can never exist without its student record.
   */
  async provision(
    studentId: string,
    provisionedBy: string,
    options?: {
      /**
       * The address to provision against.
       *
       * When the student record already carries an address, this must match
       * it. When the record has none, this address is written to it — that is
       * how a student added without an email gets one.
       */
      email?: string;
      ip?: string;
      userAgent?: string;
    }
  ): Promise<ProvisionedLogin> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    const storedEmail = student.email?.trim().toLowerCase() || null;
    const suppliedEmail = options?.email?.trim().toLowerCase() || null;

    /**
     * The address the account is created against.
     *
     * A student record may arrive without one — the exam cell often knows
     * the roll number long before the student's email. When the caller
     * supplies an address at provisioning time it is written to the record
     * so the academic row and the account agree.
     */
    const email = storedEmail ?? suppliedEmail;
    if (!email) {
      throw new BadRequestException(
        'This student record has no email address. Supply one to provision a login.'
      );
    }

    /**
     * When the record already carries an address, the caller's has to agree
     * with it. Without this check a caller could provision an account under
     * an address the academic record does not carry, and the login would
     * then be linked to a student who never owns it.
     */
    if (storedEmail && suppliedEmail && storedEmail !== suppliedEmail) {
      throw new BadRequestException('The email does not match the one on the student record.');
    }

    // A student record may already point at an account — nothing to do.
    if (student.userId) {
      const linked = await this.prisma.user.findUnique({
        where: { id: student.userId },
        select: { id: true, email: true },
      });
      if (linked) {
        return {
          studentId: student.id,
          studentName: student.name,
          rollNo: student.rollNo,
          email: linked.email,
          userId: linked.id,
          created: false,
          temporaryPassword: null,
        };
      }
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    const role = await this.prisma.role.findUnique({
      where: { name: STUDENT_ROLE },
      select: { id: true },
    });
    if (!role) {
      throw new BadRequestException(
        'The STUDENT role is not configured. Seed the roles before provisioning student logins.'
      );
    }

    let temporaryPassword: string | null = null;
    let userId: string;
    let created = false;

    if (existingUser) {
      /**
       * The account already exists — this student is being linked to it.
       * The temporary password stays null: the caller does not own that
       * account's password and must not be handed one.
       */
      userId = existingUser.id;

      const alreadyLinked = await this.prisma.student.findFirst({
        where: { userId: existingUser.id, id: { not: student.id } },
        select: { id: true },
      });
      if (alreadyLinked) {
        throw new ConflictException('That email is already linked to a different student record.');
      }
    } else {
      temporaryPassword = this.generateTemporaryPassword();
      // The hash is computed before the transaction opens: bcrypt is
      // deliberately slow, and holding a database connection open for the
      // duration would starve the pool.
      const passwordHash = await bcrypt.hash(temporaryPassword, this.bcryptRounds);
      userId = '';
      created = true;

      /**
       * The account, the role assignment and the `Student.userId` link are
       * written together. A failure anywhere leaves the database exactly as
       * it was — no orphan account without its student record, and no
       * student record pointing at an account that was never created.
       */
      await this.runTransaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            name: student.name,
            passwordHash,
            isActive: true,
            // The student must replace the temporary password on first login.
            mustChangePassword: true,
            createdBy: provisionedBy,
            updatedBy: provisionedBy,
          },
          select: { id: true, email: true },
        });
        userId = user.id;

        await tx.student.update({
          where: { id: student.id },
          data: {
            userId: user.id,
            // The address the account was created against is written to the
            // academic record, so the two never drift apart.
            ...(storedEmail ? {} : { email }),
            updatedBy: provisionedBy,
          },
        });

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
            // The STUDENT role is not branch-scoped: a student is identified
            // by their own record, not by a branch assignment.
            branchId: null,
            grantedBy: provisionedBy,
          },
        });
      });
    }

    if (!created) {
      /**
       * The account already existed, so only the link and the role
       * assignment are written. The STUDENT role is not branch-scoped: a
       * student is identified by their own record, not by a branch
       * assignment.
       */
      await this.runTransaction(async (tx) => {
        await tx.student.update({
          where: { id: student.id },
          data: {
            userId,
            ...(storedEmail ? {} : { email }),
            updatedBy: provisionedBy,
          },
        });

        const existingRole = await tx.userRole.findFirst({
          where: { userId, roleId: role.id, branchId: null },
          select: { id: true },
        });
        if (!existingRole) {
          await tx.userRole.create({
            data: {
              userId,
              roleId: role.id,
              branchId: null,
              grantedBy: provisionedBy,
            },
          });
        }
      });
    }

    // The new role changes the account's effective permissions, so the
    // cached permission set has to be dropped.
    await this.cache.incr(CacheKeys.rbacVersion);

    await this.auditService.record({
      userId: provisionedBy,
      action: created ? AuditAction.CREATE : AuditAction.UPDATE,
      resource: AuditResource.STUDENT,
      resourceId: student.id,
      // The temporary password is deliberately absent — only the ids and the
      // email are recorded.
      details: {
        event: created ? 'STUDENT_LOGIN_PROVISIONED' : 'STUDENT_LOGIN_LINKED',
        studentId: student.id,
        rollNo: student.rollNo,
        userId,
        email,
        roleName: STUDENT_ROLE,
      },
      requestContext: {
        ipAddress: options?.ip,
        userAgent: options?.userAgent,
      },
    });

    this.logger.log(
      `${created ? 'Provisioned' : 'Linked'} a login for student ${student.rollNo} (${email}).`
    );

    return {
      studentId: student.id,
      studentName: student.name,
      rollNo: student.rollNo,
      email,
      userId,
      created,
      temporaryPassword,
    };
  }

  /**
   * Runs the provisioning writes in a transaction, turning a unique-constraint
   * violation into a readable conflict.
   *
   * Both `User.email` and `Student.email` are unique. Two concurrent
   * provisioning calls for the same address — or an address already taken by
   * another student record — surface as a raw Prisma error otherwise, which
   * the API turns into an opaque 500.
   */
  private async runTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(work);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          'That email address is already in use by another account or student record.'
        );
      }
      throw err;
    }
  }

  /**
   * Generates a temporary password.
   *
   * The characters come from `randomBytes`, a cryptographically secure
   * source. Rejection sampling keeps the distribution uniform: taking the
   * raw byte modulo the alphabet size would favour the first few letters.
   */
  private generateTemporaryPassword(): string {
    const alphabetLength = TEMP_PASSWORD_ALPHABET.length;
    const out: string[] = [];

    while (out.length < TEMP_PASSWORD_LENGTH) {
      const bytes = randomBytes(TEMP_PASSWORD_LENGTH * 2);
      for (const byte of bytes) {
        // 256 is not a multiple of the alphabet size, so the tail of the
        // range would be over-represented. Those bytes are discarded.
        if (byte >= Math.floor(256 / alphabetLength) * alphabetLength) continue;
        out.push(TEMP_PASSWORD_ALPHABET[byte % alphabetLength]);
        if (out.length === TEMP_PASSWORD_LENGTH) break;
      }
    }

    return out.join('');
  }
}
