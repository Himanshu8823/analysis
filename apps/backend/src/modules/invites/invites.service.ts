import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import {
  BRANCH_SCOPED_ROLES,
  INVITABLE_ROLES,
  canGrantRole,
  isUserRole,
} from '@/common/constants/roles';
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
    private readonly config: ConfigService
  ) {}

  private get frontendUrl(): string {
    return this.config.get<string>('email.frontendUrl') ?? 'http://localhost:3000';
  }

  private get inviteTtlHours(): number {
    return this.config.get<number>('email.inviteTtlHours') ?? 168;
  }

  /**
   * The role names a member holds.
   *
   * Read fresh from the database rather than from the caller's token,
   * because the token carries a single role while a member may hold several
   * at once. The union of those roles is what decides what they may grant.
   */
  private async rolesHeldBy(userId: string): Promise<string[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { name: true } } },
    });

    return assignments.map((assignment) => assignment.role.name);
  }

  /**
   * The branches a member works in.
   *
   * An empty list means the member is college-wide and may invite into any
   * branch.
   */
  private async branchesHeldBy(userId: string): Promise<string[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: { userId, branchId: { not: null } },
      select: { branchId: true },
    });

    return assignments
      .map((assignment) => assignment.branchId)
      .filter((id): id is string => typeof id === 'string');
  }

  /**
   * Creates an invitation and sends the acceptance email.
   *
   * Returns the invite record together with the accept URL so an administrator
   * can share the link manually if the email does not arrive. That is a
   * convenience for an already-privileged user, not a security hole.
   */
  async create(
    dto: InviteUserDto,
    invitedById: string,
    metadata?: { ip?: string; userAgent?: string }
  ) {
    const email = dto.email.toLowerCase().trim();

    if (email === invitedById) {
      throw new BadRequestException('You cannot invite yourself');
    }

    if (!INVITABLE_ROLES.includes(dto.roleName as UserRole)) {
      throw new BadRequestException('That role cannot be assigned through an invitation');
    }

    /**
     * A member may invite only into the authority they hold themselves.
     *
     * Without this, anybody who can send an invitation could mint a
     * Principal — or an Admin — and from there reach every branch of the
     * college. The invitation is a way of creating an account; the role on
     * that account is the part that carries authority, so the check belongs
     * on the role.
     *
     * The inviter's roles are read from the database rather than from the
     * token, because the token carries one role and a member may hold
     * several.
     */
    const heldRoles = await this.rolesHeldBy(invitedById);
    if (!canGrantRole(heldRoles, dto.roleName)) {
      throw new ForbiddenException(
        `You cannot invite someone as ${dto.roleName}. You can only invite people into roles below your own.`
      );
    }

    // A branch-scoped role needs a branch, and a global role must not carry one.
    const isBranchScoped = BRANCH_SCOPED_ROLES.includes(dto.roleName as UserRole);
    if (isBranchScoped && !dto.branchId) {
      throw new BadRequestException(`The ${dto.roleName} role requires a branch`);
    }
    if (!isBranchScoped && dto.branchId) {
      throw new BadRequestException(`The ${dto.roleName} role is not branch-scoped`);
    }

    /**
     * A branch-scoped member may not invite someone into another branch.
     *
     * A Teacher who works in Computer Science must not be able to appoint a
     * Principal in Mechanical Engineering. That is authority over a branch
     * the teacher does not belong to, and it is how a college's branch
     * boundaries quietly stop meaning anything.
     */
    if (dto.branchId) {
      const inviterBranches = await this.branchesHeldBy(invitedById);
      if (inviterBranches.length > 0 && !inviterBranches.includes(dto.branchId)) {
        throw new ForbiddenException('You cannot invite someone into a branch you do not work in.');
      }
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

  /**
   * The invitations a member may see.
   *
   * The list is narrowed to the branches the member works in, plus the
   * invitations they raised themselves. Without this, a Computer Science
   * teacher would see the pending invitations for every other branch —
   * names, email addresses and roles that are none of their business.
   */
  async findAll(params: ListInvitesDto, requestedById: string) {
    const branchIds = await this.branchesHeldBy(requestedById);
    const result = await this.repository.findAll({
      status: params.status as InviteStatus | undefined,
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
      branchIds: branchIds.length > 0 ? branchIds : undefined,
      requestedBy: requestedById,
    });

    return {
      items: result.items.map((invite) => this.toResponse(invite)),
      meta: result.meta,
    };
  }

  /**
   * The counters for the invitation tabs.
   *
   * They are counted over the same scope as the list, so the number on the
   * tab always agrees with the number of rows underneath it.
   */
  async countByStatus(requestedById: string) {
    const branchIds = await this.branchesHeldBy(requestedById);
    return this.repository.countByStatus({
      branchIds: branchIds.length > 0 ? branchIds : undefined,
      requestedBy: requestedById,
    });
  }

  /**
   * Whether a member may act on an invitation.
   *
   * An invitation belongs to a branch, and it names a person who will join
   * that branch. A member of another branch has no authority over it: they
   * cannot see it in the list, and they must not be able to revoke or
   * reissue it by guessing its id.
   *
   * The invitation the member raised themselves is always theirs to manage,
   * whatever branch it names — a Principal who invited an Admin across the
   * college must still be able to revoke that invitation.
   */
  private async mayManageInvite(
    invite: { branchId: string | null; invitedById: string },
    userId: string
  ): Promise<boolean> {
    if (invite.invitedById === userId) return true;

    const branches = await this.branchesHeldBy(userId);
    if (branches.length === 0) return true; // College-wide member.

    return invite.branchId !== null && branches.includes(invite.branchId);
  }

  /**
   * Revokes a pending invitation. The link stops working immediately.
   */
  async revoke(id: string, revokedBy: string, metadata?: { ip?: string; userAgent?: string }) {
    const invite = await this.repository.findById(id);
    if (!invite) {
      throw new NotFoundException('Invitation not found');
    }
    if (!(await this.mayManageInvite(invite, revokedBy))) {
      throw new ForbiddenException('You do not have access to this invitation');
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
    if (!(await this.mayManageInvite(invite, invitedById))) {
      throw new ForbiddenException('You do not have access to this invitation');
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
          'Share the invitation link manually.'
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
          `${err instanceof Error ? err.message : String(err)}`
      );
      throw new ServiceUnavailableException(
        'The invitation could not be emailed. Please try again or contact your administrator.'
      );
    }
  }

  /** Maps an invite row to the API response shape. */
  private toResponse(
    invite: Invite & { branch?: { id: string; code: string; name: string } | null }
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
