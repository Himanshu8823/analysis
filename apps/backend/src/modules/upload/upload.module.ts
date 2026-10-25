import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { UploadRepository } from './upload.repository';
import { UploadProcessor } from './processors/upload.processor';
import { RbacModule } from '@/modules/rbac/rbac.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'upload-jobs' }),
    BullModule.registerQueue({ name: 'ocr-jobs' }),
    // The confirm path resolves the caller's own permissions to decide
    // between the exam cell's reach and the teacher's allocation-limited one.
    RbacModule,
  ],
  controllers: [UploadController],
  providers: [UploadService, UploadRepository, UploadProcessor],
  exports: [UploadService],
})
export class UploadModule {}
