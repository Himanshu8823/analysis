import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PasswordResetService } from './password-reset.service';
import { ForgotPasswordDto, ResetPasswordDto } from './dto';
import { Public } from '@/common/decorators';

@ApiTags('Password Reset')
@Controller('auth')
export class PasswordResetController {
  constructor(private readonly service: PasswordResetService) {}

  /**
   * Requests a reset link.
   *
   * Public and heavily rate limited — it is an unauthenticated endpoint that
   * triggers outbound email, so it must not be usable to flood a mailbox.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 per 15 min
  @ApiOperation({ summary: 'Request a password reset link' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    return this.service.requestReset(dto.email, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  /**
   * Completes a password reset.
   *
   * Public because the requester is not signed in — the one-time token in the
   * email is the credential.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 per 15 min
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request): Promise<void> {
    await this.service.resetPassword(dto.token, dto.password, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
