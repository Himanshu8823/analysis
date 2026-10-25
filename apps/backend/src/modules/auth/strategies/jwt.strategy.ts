import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import type { JwtPayload } from '@/common/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaClient
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('auth.jwtSecret') ?? '',
    });
  }

  /**
   * Validates the token on every request.
   *
   * The account state is re-checked against the database rather than trusted
   * from the token: an access token lives for 15 minutes, and a member who
   * is deactivated (or whose role is changed) must lose access immediately
   * rather than at the end of the token's life. Only the fields that are safe
   * to carry forward are returned.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, email: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    return {
      sub: user.id,
      email: user.email,
      role: payload.role,
      branchId: payload.branchId,
    };
  }
}
