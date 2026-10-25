import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { AcceptInviteDto, ChangePasswordDto, LoginDto } from './dto';
import type { JwtPayload } from '@/common/types';
import { CACHE_SERVICE } from '@/common/constants/injection-tokens';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { CacheService } from '@/common/interfaces/cache.service';
import { CacheKeys, CACHE_TTL_SECONDS } from '../cache/cache.constants';
import { InvitesService } from '../invites/invites.service';

export interface RequestMetadata {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly prisma: PrismaClient,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly auditLogsService: AuditLogsService,
    private readonly invitesService: InvitesService,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService
  ) {}

  private get bcryptRounds(): number {
    return this.config.get<number>('auth.bcryptRounds') ?? 12;
  }

  async login(dto: LoginDto, metadata?: RequestMetadata, options?: { skipAudit?: boolean }) {
    const user = await this.repository.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userRoles = await this.repository.getUserRoles(user.id);
    const primaryRole = await this.repository.getPrimaryRole(user.id);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: primaryRole,
      branchId: userRoles[0]?.branchId ?? undefined,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret: this.config.get<string>('auth.refreshSecret'),
        expiresIn: this.config.get<string>('auth.refreshExpiresIn'),
      }
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.repository.saveRefreshToken(user.id, refreshTokenHash, metadata);

    await this.repository.updateLastLogin(user.id);

    const permissions = await this.repository.getUserPermissions(user.id);
    await this.cache.set(
      CacheKeys.userPermissions(user.id, await this.currentRbacVersion()),
      JSON.stringify(permissions),
      CACHE_TTL_SECONDS
    );

    // The accept-invite flow logs `INVITE_ACCEPTED` itself, so the login it
    // triggers must not add a second, misleading `LOGIN` row.
    if (!options?.skipAudit) {
      await this.auditLogsService.log({
        userId: user.id,
        action: 'LOGIN',
        resource: 'auth',
        details: { email: user.email },
        ipAddress: metadata?.ip,
        userAgent: metadata?.userAgent,
      });
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: primaryRole,
        // Every role the member holds, and the union of their permissions.
        // The client gates its navigation on the permissions rather than on
        // a role name (§3.1), so both have to travel with the session.
        roles: userRoles.map((r) => r.name),
        permissions,
        branchId: userRoles[0]?.branchId ?? null,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  /**
   * Accepts an invitation: creates the account with the invitee's chosen
   * password and assigns the role and branch the invitation specified.
   *
   * The account and the role assignment happen in one transaction, and the
   * invitation is consumed in the same transaction — so a token can never be
   * replayed to create a second account.
   */
  async acceptInvite(dto: AcceptInviteDto, metadata?: RequestMetadata) {
    const invite = await this.invitesService.resolvePending(dto.token);

    if (invite.expiresAt.getTime() <= Date.now()) {
      await this.invitesService.expireIfNeeded(invite);
      throw new BadRequestException('This invitation has expired');
    }

    const existing = await this.repository.findByEmail(invite.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    const role = await this.prisma.role.findUnique({ where: { name: invite.roleName } });
    if (!role) {
      throw new BadRequestException('This invitation is invalid or has already been used.');
    }

    const now = new Date();

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: invite.email,
          name: invite.name,
          passwordHash,
          isActive: true,
          mustChangePassword: false,
          invitedById: invite.invitedById,
          invitedAt: now,
          createdBy: invite.invitedById,
        },
      });

      await tx.userRole.create({
        data: {
          userId: created.id,
          roleId: role.id,
          branchId: invite.branchId,
          grantedBy: invite.invitedById,
        },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED', acceptedAt: now },
      });

      return created;
    });

    await this.auditLogsService.log({
      userId: user.id,
      action: 'INVITE_ACCEPTED',
      resource: 'invite',
      resourceId: invite.id,
      details: { email: user.email, roleName: invite.roleName },
      ipAddress: metadata?.ip,
      userAgent: metadata?.userAgent,
    });

    // Reuse the login path so the token issuing, the refresh-token record and
    // the permission cache stay in one place.
    return this.login({ email: user.email, password: dto.password }, metadata, { skipAudit: true });
  }

  /**
   * Changes the signed-in user's password.
   *
   * Clears `mustChangePassword`, which is the only thing that can clear it.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    metadata?: RequestMetadata
  ): Promise<void> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('Your current password is incorrect');
    }

    if (await bcrypt.compare(dto.password, user.passwordHash)) {
      throw new BadRequestException('The new password must be different from the current one');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false, updatedBy: userId },
    });

    // Every other session of this user is invalidated: a password change must
    // end sessions opened with the old password.
    await this.repository.revokeAllRefreshTokens(userId);
    await this.cache.del(CacheKeys.userPermissions(userId, await this.currentRbacVersion()));
    // The forced-password-change gate reads the flag from the cache, so the
    // cached copy has to go with the database update.
    await this.cache.del(CacheKeys.userMustChangePassword(userId));

    await this.auditLogsService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      resource: 'auth',
      ipAddress: metadata?.ip,
      userAgent: metadata?.userAgent,
    });
  }

  /**
   * Exchanges a refresh token for a fresh access token.
   *
   * The refresh token is rotated: the presented one is revoked and a new one
   * is issued, so a stolen refresh token is usable at most once. The client
   * must store the returned `refreshToken` and send it on the next refresh.
   */
  async refresh(refreshToken: string, metadata?: RequestMetadata) {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(refreshToken, {
        secret: this.config.get<string>('auth.refreshSecret'),
      });

      const userId = payload.sub;
      const tokenRecord = await this.repository.findLatestRefreshToken(userId);
      if (!tokenRecord) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isValid = await bcrypt.compare(refreshToken, tokenRecord.tokenHash);
      if (!isValid || tokenRecord.revokedAt) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (!tokenRecord.user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const userRoles = await this.repository.getUserRoles(userId);
      const primaryRole = await this.repository.getPrimaryRole(userId);

      const newPayload: JwtPayload = {
        sub: userId,
        email: tokenRecord.user.email,
        role: primaryRole,
        branchId: userRoles[0]?.branchId ?? undefined,
      };

      const accessToken = await this.jwtService.signAsync(newPayload);
      const newRefreshToken = await this.jwtService.signAsync(
        { sub: userId },
        {
          secret: this.config.get<string>('auth.refreshSecret'),
          expiresIn: this.config.get<string>('auth.refreshExpiresIn'),
        }
      );

      // Revoke the presented token and store the replacement's hash, so the
      // old token cannot be replayed.
      await this.repository.revokeRefreshToken(tokenRecord.id);
      await this.repository.saveRefreshToken(
        userId,
        await bcrypt.hash(newRefreshToken, 10),
        metadata
      );

      return { accessToken, refreshToken: newRefreshToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.repository.revokeRefreshTokens(userId);
    await this.cache.del(CacheKeys.userPermissions(userId, await this.currentRbacVersion()));
  }

  async logoutAll(userId: string): Promise<void> {
    await this.repository.revokeAllRefreshTokens(userId);
    await this.cache.del(CacheKeys.userPermissions(userId, await this.currentRbacVersion()));
  }

  /**
   * The global RBAC version counter. Bumped on any role/permission mutation,
   * which orphans every cached permission set in O(1).
   *
   * `incr` returns 0 when Redis is unavailable, so the version collapses to
   * `v1` — a stable key whose TTL bounds staleness.
   */
  private async currentRbacVersion(): Promise<number> {
    const version = await this.cache.incr(CacheKeys.rbacVersion);
    return version > 0 ? version : 1;
  }

  async getMe(userId: string) {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    const userRoles = await this.repository.getUserRoles(userId);
    const permissions = await this.repository.getUserPermissions(userId);
    const primaryRole = await this.repository.getPrimaryRole(userId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      // `role` is the primary role the UI gates on; `roles` is the full list.
      role: primaryRole,
      roles: userRoles.map((r) => r.name),
      permissions,
      branchId: userRoles[0]?.branchId ?? null,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
