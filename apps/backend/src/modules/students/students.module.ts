import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { StudentsRepository } from './students.repository';
import { MyResultController } from './my-result.controller';
import { StudentProvisioningController } from './student-provisioning.controller';
import { StudentProfileController } from './student-profile.controller';
import { StudentSelfService } from './student-self.service';
import { StudentProvisioningService } from './student-provisioning.service';
import { StudentBulkProvisioningService } from './student-bulk-provisioning.service';
import { StudentProfileService } from './student-profile.service';
import { MarksModule } from '../marks/marks.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [MarksModule, AuditLogsModule],
  controllers: [
    StudentsController,
    MyResultController,
    StudentProvisioningController,
    StudentProfileController,
  ],
  providers: [
    StudentsService,
    StudentsRepository,
    StudentSelfService,
    StudentProvisioningService,
    StudentBulkProvisioningService,
    StudentProfileService,
  ],
  exports: [
    StudentsService,
    StudentSelfService,
    StudentProvisioningService,
    StudentBulkProvisioningService,
    StudentProfileService,
  ],
})
export class StudentsModule {}
