import { Injectable } from '@nestjs/common';
import { AuditLogsRepository } from './audit-logs.repository';

export interface LogAuditInput {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly repository: AuditLogsRepository) {}

  async log(input: LogAuditInput): Promise<void> {
    await this.repository.create(input);
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    userId?: string;
    action?: string;
    resource?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    return this.repository.findAll(params);
  }

  async findById(id: string) {
    return this.repository.findById(id);
  }
}