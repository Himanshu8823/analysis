import {
  Controller, Get, Post, Delete, Body, Param, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto';
import { Roles, CurrentUser } from '@/common/decorators';
import { parseOptionalInt } from '@/common/utils/query-params';
import type { JwtPayload } from '@/common/types';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for current user' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.service.findAllForUser({
      userId: user.sub,
      page: parseOptionalInt(page),
      pageSize: parseOptionalInt(pageSize),
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create a notification (admin/system)' })
  async create(@Body() dto: CreateNotificationDto) {
    return this.service.create(dto);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markAsRead(id, user.sub);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAll(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.service.markAllAsRead(user.sub);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<void> {
    return this.service.delete(id, user.sub);
  }
}