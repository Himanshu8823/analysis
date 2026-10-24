import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { InvitesService } from './invites.service';
import { InviteUserDto, ListInvitesDto } from './dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/types';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /**
   * Creates an invitation and emails the acceptance link.
   *
   * Super Admin only — the caller must hold both `SUPER_ADMIN` and
   * `invites:write`.
   */
  @Post()
  @Roles('SUPER_ADMIN')
  @Permissions('invites:write')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: InviteUserDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
  ) {
    return this.invitesService.create(dto, user.sub, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  /** Lists invitations, newest first. */
  @Get()
  @Roles('SUPER_ADMIN')
  @Permissions('invites:read')
  async findAll(@Query() query: ListInvitesDto) {
    return this.invitesService.findAll(query);
  }

  /** Counts invitations per status — used for the tab counters. */
  @Get('counts')
  @Roles('SUPER_ADMIN')
  @Permissions('invites:read')
  async counts() {
    return this.invitesService.countByStatus();
  }

  /**
   * Validates an invitation token.
   *
   * Public (the recipient is not signed in yet) but rate limited, because it
   * is a token oracle: without throttling it could be used to guess tokens.
   */
  @Get('validate')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  async validate(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('A token is required');
    }
    return this.invitesService.validate(token);
  }

  /** Revokes a pending invitation. */
  @Post(':id/revoke')
  @Roles('SUPER_ADMIN')
  @Permissions('invites:write')
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
  ) {
    return this.invitesService.revoke(id, user.sub, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  /** Issues a fresh invitation and sends a new email. */
  @Post(':id/resend')
  @Roles('SUPER_ADMIN')
  @Permissions('invites:write')
  @HttpCode(HttpStatus.CREATED)
  async resend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
  ) {
    return this.invitesService.resend(id, user.sub, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
