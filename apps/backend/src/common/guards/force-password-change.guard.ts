import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CACHE_SERVICE } from '../constants/injection-tokens';
import { CacheKeys } from '@/modules/cache/cache.constants';
import type { CacheService } from '../interfaces/cache.service';
import type { JwtPayload } from '../types';
import type { Request } from 'express';

/**
 * Blocks every authenticated route while the user still has to change their
 * password.
 *
 * The frontend redirect is a convenience, not a control — without this guard
 * a user (or a script holding their token) could simply skip the page and
 * keep using the API with the old password.
 *
 * The flag is read through a short-lived cache entry so the common case
 * (a user with no pending change) costs one Redis hit, not a database query
 * per request.
 */
@Injectable()
export class ForcePasswordChangeGuard implements CanActivate {
  /** The flag changes only when the user changes their password, so a short
   * TTL is enough to bound staleness. */
  private static readonly FLAG_TTL_SECONDS = 60;

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaClient,
    @Inject(CACHE_SERVICE) private readonly cache: CacheService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    // Public routes have no user to gate.
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) === true) {
      return true;
    }

    // Routes explicitly exempted from the gate (the change-password endpoint
    // itself, and logout so the user can escape).
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_KEY, targets) === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const userId = request.user?.sub;
    if (!userId) {
      // Not authenticated — the JwtAuthGuard handles that case.
      return true;
    }

    if (!(await this.mustChangePassword(userId))) {
      return true;
    }

    throw new ForbiddenException('You must change your password before using the system');
  }

  private async mustChangePassword(userId: string): Promise<boolean> {
    const key = CacheKeys.userMustChangePassword(userId);
    const cached = await this.cache.get(key);
    if (cached !== null) {
      return cached === '1';
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mustChangePassword: true },
    });

    // A missing user cannot change a password; let the request continue and
    // fail later with a more specific error rather than here.
    const flag = user?.mustChangePassword ?? false;

    await this.cache.set(key, flag ? '1' : '0', ForcePasswordChangeGuard.FLAG_TTL_SECONDS);
    return flag;
  }
}
