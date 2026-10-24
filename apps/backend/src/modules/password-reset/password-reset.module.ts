import { Module } from '@nestjs/common';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetRepository } from './password-reset.repository';
import { EmailModule } from '../email/email.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [EmailModule, AuditLogsModule],
  controllers: [PasswordResetController],
  providers: [PasswordResetService, PasswordResetRepository],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
