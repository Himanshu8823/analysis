import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { UploadRepository } from './upload.repository';
import { UploadProcessor } from './processors/upload.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'upload-jobs' }),
    BullModule.registerQueue({ name: 'ocr-jobs' }),
  ],
  controllers: [UploadController],
  providers: [UploadService, UploadRepository, UploadProcessor],
  exports: [UploadService],
})
export class UploadModule {}
