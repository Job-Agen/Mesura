import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { EmailMessage, EmailProvider } from '../email-provider.interface';

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
}

/** Sends e-mail through an SMTP server, e.g. Gmail with an app password (smtp.gmail.com:465). */
export class SmtpEmailProvider implements EmailProvider {
  readonly delivers = true;
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private readonly transport: Transporter;

  constructor(
    settings: SmtpSettings,
    private readonly from: string,
  ) {
    this.transport = createTransport({
      host: settings.host,
      port: settings.port,
      // 465 is TLS from the start; 587 upgrades with STARTTLS.
      secure: settings.port === 465,
      auth: { user: settings.user, pass: settings.pass },
      // A serverless function must not hang on a slow server.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transport.sendMail({ from: this.from, to: message.to, subject: message.subject, text: message.text, html: message.html });
    } catch (error) {
      // The error may quote the message; log only its code.
      const code = (error as { code?: string; responseCode?: number }).responseCode ?? (error as { code?: string }).code ?? 'unknown';
      this.logger.error(`SMTP refused the message (${code})`);
      throw new Error(`E-mail delivery failed (${code})`);
    }
  }
}
