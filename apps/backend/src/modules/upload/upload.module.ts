import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { UploadRepository } from './upload.repository';
import { UploadProcessor } from './processors/upload.processor';
import { RbacModule } from '@/modules/rbac/rbac.module';
import { MarksModule } from '@/modules/marks/marks.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'upload-jobs' }),
    BullModule.registerQueue({ name: 'ocr-jobs' }),
    // The confirm path resolves the caller's own permissions to decide
    // between the exam cell's reach and the teacher's allocation-limited one.
    RbacModule,
    // The confirm path writes marks, so it answers the same question the
    // marks screen does: may this member write this mark? The rule lives in
    // one place — a second copy of it here would be a second rule, and two
    // rules drift.
    MarksModule,
  ],
  controllers: [UploadController],
  providers: [UploadService, UploadRepository, UploadProcessor],
  exports: [UploadService],
})
export class UploadModule {}
