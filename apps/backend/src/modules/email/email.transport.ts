import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * SMTP transport for outgoing mail.
 *
 * The transport is created lazily and reused (nodemailer pools connections).
 * When SMTP is not configured the module still boots — `isConfigured()` returns
 * false and callers get a clear error instead of a crash.
 */
@Injectable()
export class EmailTransport implements OnModuleInit {
  private readonly logger = new Logger(EmailTransport.name);

  private transporter: Transporter | null = null;
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('email.host');
    const port = this.config.get<number>('email.port');
    const secure = this.config.get<boolean>('email.secure');
    const user = this.config.get<string>('email.user');
    const pass = this.config.get<string>('email.pass');
    const from = this.config.get<string>('email.from');

    if (!host || !from) {
      this.logger.warn(
        'SMTP is not configured (SMTP_HOST / SMTP_FROM are empty). ' +
          'Outgoing email is disabled — invitation links will have to be shared manually.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      // Some providers accept unauthenticated relay on a local network;
      // an empty username means "no auth", which is a valid SMTP mode.
      auth: user ? { user, pass } : undefined,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

    this.configured = true;

    // Verify once at boot so a misconfigured server is visible in the logs
    // immediately. A failure warns — it must not take the application down.
    void this.verify();
  }

  /** Whether SMTP is configured and usable. */
  isConfigured(): boolean {
    return this.configured && this.transporter !== null;
  }

  /**
   * Checks the SMTP connection.
   *
   * Returns `true` on success and `false` on failure — never throws, so a
   * caller can treat "SMTP is down" as a degraded state rather than an error.
   */
  async verify(): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.verify();
      this.logger.log(`SMTP transport verified (${this.config.get<string>('email.host')})`);
      return true;
    } catch (err) {
      this.logger.warn(
        `SMTP verification failed: ${err instanceof Error ? err.message : String(err)}. ` +
          'Email sending will retry per job.',
      );
      return false;
    }
  }

  /** The `From` address, always taken from configuration. */
  get from(): string {
    const address = this.config.get<string>('email.from') ?? '';
    const name = this.config.get<string>('email.fromName');
    return name ? `"${name}" <${address}>` : address;
  }

  getTransporter(): Transporter {
    if (!this.transporter) {
      throw new Error('SMTP transport is not configured');
    }
    return this.transporter;
  }
}
