import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService, type EmailJobData } from './email.service';
import { EMAIL_QUEUE_NAME } from './email.constants';

/**
 * BullMQ worker for `email-jobs`.
 *
 * Jobs are configured with three attempts and exponential backoff by
 * `EmailService.queue`, so a transient SMTP failure is retried instead of
 * dropping the invitation.
 */
@Processor(EMAIL_QUEUE_NAME)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<{ to: string; messageId: string }> {
    const { to, subject, html, text } = job.data;
    this.logger.log(`Sending email "${subject}" to ${to} (attempt ${job.attemptsMade + 1})`);

    const result = await this.emailService.send({ to, subject, html, text });
    return { to: result.to, messageId: result.messageId };
  }
}
