import { Logger } from '@nestjs/common';
import type { EmailMessage, EmailProvider } from '../email-provider.interface';

/** Used when no e-mail service is configured: nothing is sent, nothing secret is logged. */
export class LogEmailProvider implements EmailProvider {
  readonly delivers = false;
  private readonly logger = new Logger(LogEmailProvider.name);

  async send(message: EmailMessage): Promise<void> {
    this.logger.warn(`E-mail not sent (no e-mail service configured: RESEND_API_KEY or SMTP_*): "${message.subject}"`);
  }
}
