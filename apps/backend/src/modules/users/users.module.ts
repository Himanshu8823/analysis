import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { MemberRevocationService } from './member-revocation.service';
import { MemberImpactService } from './member-impact.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, MemberRevocationService, MemberImpactService],
  exports: [UsersService, MemberRevocationService, MemberImpactService],
})
export class UsersModule {}
