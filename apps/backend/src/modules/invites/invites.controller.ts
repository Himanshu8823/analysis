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
   * The caller must hold the `invites:write` permission.
   */
  @Post()
  @Permissions('invites:write')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: InviteUserDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request
  ) {
    return this.invitesService.create(dto, user.sub, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  /**
   * Lists invitations, newest first.
   *
   * The list is narrowed to the caller's own branches, so a member never
   * sees the invitations of a branch they do not work in.
   */
  @Get()
  @Permissions('invites:read')
  async findAll(@Query() query: ListInvitesDto, @CurrentUser() user: JwtPayload) {
    return this.invitesService.findAll(query, user.sub);
  }

  /**
   * Counts invitations per status — used for the tab counters.
   *
   * Counted over the same scope as the list, so the tab and the rows
   * beneath it always agree.
   */
  @Get('counts')
  @Permissions('invites:read')
  async counts(@CurrentUser() user: JwtPayload) {
    return this.invitesService.countByStatus(user.sub);
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
  @Permissions('invites:write')
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request
  ) {
    return this.invitesService.revoke(id, user.sub, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  /** Issues a fresh invitation and sends a new email. */
  @Post(':id/resend')
  @Permissions('invites:write')
  @HttpCode(HttpStatus.CREATED)
  async resend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request
  ) {
    return this.invitesService.resend(id, user.sub, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
