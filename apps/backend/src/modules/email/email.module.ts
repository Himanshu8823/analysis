import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { EmailTransport } from './email.transport';
import { EMAIL_QUEUE_NAME } from './email.constants';

@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE_NAME })],
  providers: [EmailService, EmailProcessor, EmailTransport],
  exports: [EmailService, EmailTransport],
})
export class EmailModule {}
