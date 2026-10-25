import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { InvitesRepository } from './invites.repository';
import { InviteUserDto, ListInvitesDto } from './dto';
import { EmailService } from '../email/email.service';
import { renderInviteEmail } from '../email/templates/invite.template';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { BRANCH_SCOPED_ROLES, INVITABLE_ROLES, isUserRole } from '@/common/constants/roles';
import type { InviteStatus, UserRole } from '@result-analysis/shared-types';
import type { Invite } from '@prisma/client';

/** The role of an invite, narrowed to a known role name. */
function toUserRole(roleName: string): UserRole {
  return isUserRole(roleName) ? roleName : 'STUDENT';
}

/** The message returned for every invalid-token failure mode (no enumeration). */
const INVALID_INVITE_MESSAGE = 'This invitation is invalid or has already been used.';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly repository: InvitesRepository,
    private readonly prisma: PrismaClient,
    private readonly emailService: EmailService,
    private readonly auditLogsService: AuditLogsService,
    private readonly config: ConfigService,
  ) {}

  private get frontendUrl(): string {
    return this.config.get<string>('email.frontendUrl') ?? 'http://localhost:3000';
  }

  private get inviteTtlHours(): number {
    return this.config.get<number>('email.inviteTtlHours') ?? 168;
  }

  /**
   * Creates an invitation and sends the acceptance email.
   *
   * Returns the invite record together with the accept URL so an administrator
   * can share the link manually if the email does not arrive. That is a
   * convenience for an already-privileged user, not a security hole.
   */
  async create(dto: InviteUserDto, invitedById: string, metadata?: { ip?: string; userAgent?: string }) {
    const email = dto.email.toLowerCase().trim();

    if (email === invitedById) {
      throw new BadRequestException('You cannot invite yourself');
    }

    if (!INVITABLE_ROLES.includes(dto.roleName as UserRole)) {
      throw new BadRequestException('That role cannot be assigned through an invitation');
    }

    // A branch-scoped role needs a branch, and a global role must not carry one.
    const isBranchScoped = BRANCH_SCOPED_ROLES.includes(dto.roleName as UserRole);
    if (isBranchScoped && !dto.branchId) {
      throw new BadRequestException(`The ${dto.roleName} role requires a branch`);
    }
    if (!isBranchScoped && dto.branchId) {
      throw new BadRequestException(`The ${dto.roleName} role is not branch-scoped`);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    // Supersede any outstanding invitation for the same address, so a resend
    // never leaves two live links for one person.
    const pending = await this.repository.findPendingByEmail(email);

    // 256 bits of entropy, hex-encoded. The raw token exists only inside the
    // email link — only its SHA-256 hash is persisted.
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    const expiresAt = new Date(Date.now() + this.inviteTtlHours * 60 * 60 * 1000);

    const invite = await this.repository.create({
      email,
      name: dto.name.trim(),
      roleName: dto.roleName,
      branchId: dto.branchId ?? null,
      tokenHash,
      expiresAt,
      invitedById,
    });

    if (pending) {
      // The old link is dead, but it is marked as replaced rather than simply
      // revoked, so the list can tell the two apart.
      await this.repository.supersede(pending.id, invite.id);
    }

    const inviteUrl = this.buildInviteUrl(rawToken);
    await this.sendInviteEmail(invite, inviteUrl);

    await this.auditLogsService.log({
      userId: invitedById,
      action: 'INVITE_SENT',
      resource: 'invite',
      resourceId: invite.id,
      // The token is deliberately absent — only the invitation id is recorded.
      details: { email, roleName: dto.roleName, branchId: dto.branchId ?? null },
      ipAddress: metadata?.ip,
      userAgent: metadata?.userAgent,
    });

    return { ...this.toResponse(invite), inviteUrl };
  }

  async findAll(params: ListInvitesDto) {
    const result = await this.repository.findAll({
      status: params.status as InviteStatus | undefined,
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
    });

    return {
      items: result.items.map((invite) => this.toResponse(invite)),
      meta: result.meta,
    };
  }

  async countByStatus() {
    return this.repository.countByStatus();
  }

  /**
   * Revokes a pending invitation. The link stops working immediately.
   */
  async revoke(id: string, revokedBy: string, metadata?: { ip?: string; userAgent?: string }) {
    const invite = await this.repository.findById(id);
    if (!invite) {
      throw new NotFoundException('Invitation not found');
    }
    if (invite.status !== 'PENDING') {
      throw new BadRequestException('Only a pending invitation can be revoked');
    }

    const revoked = await this.repository.revoke(id);

    await this.auditLogsService.log({
      userId: revokedBy,
      action: 'INVITE_REVOKED',
      resource: 'invite',
      resourceId: id,
      details: { email: revoked.email },
      ipAddress: metadata?.ip,
      userAgent: metadata?.userAgent,
    });

    return this.toResponse(revoked);
  }

  /**
   * Issues a fresh invitation for the same person and sends a new email.
   *
   * The old link is revoked first, so only the newest link works.
   */
  async resend(id: string, invitedById: string, metadata?: { ip?: string; userAgent?: string }) {
    const invite = await this.repository.findById(id);
    if (!invite) {
      throw new NotFoundException('Invitation not found');
    }
    if (invite.status === 'ACCEPTED') {
      throw new BadRequestException('This invitation has already been accepted');
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.inviteTtlHours * 60 * 60 * 1000);

    const resent = await this.repository.create({
      email: invite.email,
      name: invite.name,
      roleName: invite.roleName,
      branchId: invite.branchId,
      tokenHash,
      expiresAt,
      invitedById,
    });

    if (invite.status === 'PENDING') {
      // The old link is dead, but it is marked as replaced rather than simply
      // revoked, so the list can tell the two apart.
      await this.repository.supersede(id, resent.id);
    }

    const inviteUrl = this.buildInviteUrl(rawToken);
    await this.sendInviteEmail(resent, inviteUrl);

    await this.auditLogsService.log({
      userId: invitedById,
      action: 'INVITE_RESENT',
      resource: 'invite',
      resourceId: resent.id,
      details: { email: resent.email, previousInviteId: id },
      ipAddress: metadata?.ip,
      userAgent: metadata?.userAgent,
    });

    return { ...this.toResponse(resent), inviteUrl };
  }

  /**
   * Checks an invitation token without consuming it.
   *
   * Returns only non-secret fields — the token itself is never echoed back.
   */
  async validate(rawToken: string) {
    const invite = await this.repository.findByTokenHash(this.hashToken(rawToken));
    if (!invite || invite.status !== 'PENDING') {
      throw new BadRequestException(INVALID_INVITE_MESSAGE);
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      await this.repository.markExpired(invite.id);
      throw new BadRequestException('This invitation has expired');
    }

    return {
      valid: true as const,
      email: invite.email,
      name: invite.name,
      roleName: toUserRole(invite.roleName),
      branchId: invite.branchId,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  /**
   * Resolves the invitation for a raw token, without consuming it.
   * Used by the accept flow, which needs the role and branch.
   */
  async resolvePending(rawToken: string): Promise<Invite> {
    const invite = await this.repository.findByTokenHash(this.hashToken(rawToken));
    if (!invite || invite.status !== 'PENDING') {
      throw new BadRequestException(INVALID_INVITE_MESSAGE);
    }
    return invite;
  }

  /** Marks an invitation as expired if its window has elapsed. */
  async expireIfNeeded(invite: Invite): Promise<void> {
    if (invite.status === 'PENDING' && invite.expiresAt.getTime() <= Date.now()) {
      await this.repository.markExpired(invite.id);
    }
  }

  /** Marks an invitation as accepted. */
  async markAccepted(id: string): Promise<Invite> {
    return this.repository.markAccepted(id);
  }

  /** SHA-256 of the raw token — the only form that is ever persisted. */
  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /** Builds the accept-invite URL shown in the email. */
  buildInviteUrl(rawToken: string): string {
    return `${this.frontendUrl}/accept-invite?token=${encodeURIComponent(rawToken)}`;
  }

  /**
   * Queues the invitation email.
   *
   * When SMTP is not configured the invitation is still created — the accept
   * URL is returned in the response so the administrator can share it
   * manually. Failing here would leave a live invitation nobody can use.
   */
  private async sendInviteEmail(invite: Invite, inviteUrl: string): Promise<void> {
    if (!this.emailService.isConfigured()) {
      this.logger.warn(
        `SMTP is not configured — the invitation email for ${invite.email} was not sent. ` +
          'Share the invitation link manually.',
      );
      return;
    }

    const { subject, html, text } = renderInviteEmail({
      name: invite.name,
      email: invite.email,
      roleName: invite.roleName,
      inviteUrl,
      expiresAt: new Date(invite.expiresAt),
    });

    try {
      await this.emailService.queue({ to: invite.email, subject, html, text });
    } catch (err) {
      this.logger.error(
        `Failed to queue the invitation email for ${invite.email}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        'The invitation could not be emailed. Please try again or contact your administrator.',
      );
    }
  }

  /** Maps an invite row to the API response shape. */
  private toResponse(
    invite: Invite & { branch?: { id: string; code: string; name: string } | null },
  ) {
    return {
      id: invite.id,
      email: invite.email,
      name: invite.name,
      roleName: toUserRole(invite.roleName),
      branchId: invite.branchId,
      branch: invite.branch
        ? { id: invite.branch.id, code: invite.branch.code, name: invite.branch.name }
        : null,
      status: invite.status as InviteStatus,
      expiresAt: invite.expiresAt.toISOString(),
      acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
      createdAt: invite.createdAt.toISOString(),
      /**
       * Set when a resend replaced this invitation. The link is dead but the
       * record is kept for the history, so the UI labels it as superseded
       * rather than showing it as an ordinary revoked invitation.
       */
      supersededById: invite.supersededById ?? null,
    };
  }
}
