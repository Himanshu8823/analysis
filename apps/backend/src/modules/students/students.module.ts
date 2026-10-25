import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { StudentsRepository } from './students.repository';
import { MyResultController } from './my-result.controller';
import { StudentProvisioningController } from './student-provisioning.controller';
import { StudentSelfService } from './student-self.service';
import { StudentProvisioningService } from './student-provisioning.service';
import { MarksModule } from '../marks/marks.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [MarksModule, AuditLogsModule],
  controllers: [StudentsController, MyResultController, StudentProvisioningController],
  providers: [StudentsService, StudentsRepository, StudentSelfService, StudentProvisioningService],
  exports: [StudentsService, StudentSelfService, StudentProvisioningService],
})
export class StudentsModule {}
