import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailTransport } from './email.transport';
import { EMAIL_QUEUE_NAME } from './email.constants';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailSendResult {
  messageId: string;
  to: string;
}

export interface EmailQueueResult {
  queued: boolean;
  /** The BullMQ job id, when the job was enqueued. */
  jobId?: string;
  /** Set when the send happened inline because the queue was unavailable. */
  sentInline?: boolean;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly transport: EmailTransport,
    @InjectQueue(EMAIL_QUEUE_NAME) private readonly emailQueue: Queue<EmailJobData>,
  ) {}

  isConfigured(): boolean {
    return this.transport.isConfigured();
  }

  /**
   * Sends an email immediately, over the SMTP transport.
   *
   * Used by the queue worker. Throws if SMTP is not configured — the caller
   * (the worker) turns that into a failed job with a retry.
   */
  async send(data: EmailJobData): Promise<EmailSendResult> {
    if (!this.transport.isConfigured()) {
      throw new ServiceUnavailableException('Email service is not configured');
    }

    const info = await this.transport.getTransporter().sendMail({
      from: this.transport.from,
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
    });

    // The recipient and message id are safe to log; the body and any token
    // inside it are not.
    this.logger.log(`Email sent to ${data.to} (messageId: ${info.messageId})`);

    return { messageId: info.messageId, to: data.to };
  }

  /**
   * Enqueues an email for asynchronous delivery.
   *
   * The API never blocks on an SMTP round trip. If the queue is unavailable
   * the email is sent inline instead, so an invitation is never silently
   * dropped because Redis was down.
   */
  async queue(data: EmailJobData): Promise<EmailQueueResult> {
    try {
      const job = await this.emailQueue.add('send-email', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      });
      return { queued: true, jobId: job.id };
    } catch (err) {
      this.logger.warn(
        `Email queue unavailable (${err instanceof Error ? err.message : String(err)}). ` +
          'Falling back to inline delivery.',
      );
      await this.send(data);
      return { queued: false, sentInline: true };
    }
  }
}
