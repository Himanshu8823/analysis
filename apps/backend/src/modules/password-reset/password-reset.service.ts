import {
  BadRequestException, Injectable, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PasswordResetRepository } from './password-reset.repository';
import { EmailService } from '../email/email.service';
import { renderPasswordResetEmail } from '../email/templates/password-reset.template';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { RequestMetadata } from '../auth/auth.service';

/** The generic response to a reset request — it never reveals whether an account exists. */
const GENERIC_RESPONSE = 'If an account exists for that email, a reset link has been sent.';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly repository: PasswordResetRepository,
    private readonly prisma: PrismaClient,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private get bcryptRounds(): number {
    return this.config.get<number>('auth.bcryptRounds') ?? 12;
  }

  private get frontendUrl(): string {
    return this.config.get<string>('email.frontendUrl') ?? 'http://localhost:3000';
  }

  private get ttlMinutes(): number {
    return this.config.get<number>('email.passwordResetTtlMinutes') ?? 30;
  }

  /**
   * Starts a password reset.
   *
   * Always succeeds from the caller's point of view: whether or not the email
   * belongs to an account, the same message comes back. That prevents the
   * endpoint from being used to enumerate registered addresses.
   */
  async requestReset(email: string, metadata?: RequestMetadata): Promise<{ message: string }> {
    const normalised = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalised } });

    if (!user || !user.isActive) {
      // Nothing is sent, but the caller cannot tell this apart from a
      // successful request — that is the point.
      this.logger.log(`Password reset requested for an unknown or inactive address.`);
      return { message: GENERIC_RESPONSE };
    }

    // Only the latest link stays valid.
    await this.repository.revokeOutstanding(user.id);

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.ttlMinutes * 60 * 1000);

    await this.repository.create({ userId: user.id, tokenHash, expiresAt });

    const resetUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    await this.auditLogsService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      resource: 'auth',
      details: { email: user.email },
      ipAddress: metadata?.ip,
      userAgent: metadata?.userAgent,
    });

    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        `SMTP is not configured — the password reset email for ${user.email} was not sent.`,
      );
      return { message: GENERIC_RESPONSE };
    }

    const { subject, html, text } = renderPasswordResetEmail({
      name: user.name,
      email: user.email,
      resetUrl,
      expiresAt,
    });

    try {
      await this.emailService.queue({ to: user.email, subject, html, text });
    } catch (err) {
      this.logger.error(
        `Could not queue the password reset email for ${user.email}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { message: GENERIC_RESPONSE };
  }

  /**
   * Completes a password reset.
   *
   * The token is consumed and the password is written in one transaction, so
   * a link can never be replayed to change the password twice.
   */
  async resetPassword(
    token: string,
    password: string,
    metadata?: RequestMetadata,
  ): Promise<void> {
    const reset = await this.repository.findByTokenHash(this.hashToken(token));

    if (!reset || reset.usedAt) {
      throw new BadRequestException('This reset link is invalid or has already been used.');
    }

    if (reset.expiresAt.getTime() <= Date.now()) {
      await this.repository.markUsed(reset.id);
      throw new BadRequestException('This reset link has expired');
    }

    const passwordHash = await bcrypt.hash(password, this.bcryptRounds);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash, mustChangePassword: false },
      });

      await tx.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      });

      // Every existing session is invalidated — a password reset must log out
      // anyone holding a token issued before the reset.
      await tx.refreshToken.deleteMany({ where: { userId: reset.userId } });
    });

    await this.auditLogsService.log({
      userId: reset.userId,
      action: 'PASSWORD_RESET_COMPLETED',
      resource: 'auth',
      ipAddress: metadata?.ip,
      userAgent: metadata?.userAgent,
    });
  }

  /** SHA-256 of the raw token — the only form that is ever persisted. */
  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
