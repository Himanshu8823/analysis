import {
  Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AcceptInviteDto, ChangePasswordDto, LoginDto, RefreshTokenDto } from './dto';
import { Public, CurrentUser, AllowPasswordChange } from '@/common/decorators';
import type { JwtPayload } from '@/common/types';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 per 15 min
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  /**
   * Accepts an invitation and creates the account.
   *
   * Public — the invitee is not signed in yet. Rate limited because it is a
   * credential-setting endpoint.
   */
  @Public()
  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 per 15 min
  @ApiOperation({ summary: 'Accept an invitation and set your password' })
  async acceptInvite(@Body() dto: AcceptInviteDto, @Req() request: Request) {
    return this.authService.acceptInvite(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 900000 } }) // 20 per 15 min
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(dto.refreshToken, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @AllowPasswordChange()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.authService.logout(user.sub);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @AllowPasswordChange()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.authService.logoutAll(user.sub);
  }

  /**
   * Changes the signed-in user's password.
   *
   * Exempt from the forced-password-change gate — it is the endpoint that
   * clears the flag.
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @AllowPasswordChange()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
  ): Promise<void> {
    await this.authService.changePassword(user.sub, dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  /**
   * The signed-in user's profile.
   *
   * Exempt from the forced-password-change gate — the client reads
   * `mustChangePassword` from here to decide where to send the user.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @AllowPasswordChange()
  @ApiBearerAuth()
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }
}
