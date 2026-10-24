import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import { CreateNotificationDto } from './dto';
import type { Notification } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    return this.repository.create(dto);
  }

  async findAllForUser(params: {
    userId: string;
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
  }) {
    return this.repository.findAllForUser(params);
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.repository.findById(id);
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    return this.repository.markAsRead(id);
  }

  async markAllAsRead(userId: string): Promise<void> {
    return this.repository.markAllAsRead(userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    const notification = await this.repository.findById(id);
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    return this.repository.delete(id);
  }
}