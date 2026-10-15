import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PayoutProvider, PayoutStatus, SendPayoutRequest, SendPayoutResult } from '../payout-provider.interface';

/**
 * Fake Mobile Money payout. No network call, no money. Sent at once, except to a number ending in 99,
 * which fails (the same convention as the sandbox payments). The outcome is kept in the reference, so
 * any serverless instance can answer for it.
 */
@Injectable()
export class SandboxPayoutProvider implements PayoutProvider {
  private readonly logger = new Logger(SandboxPayoutProvider.name);

  async sendPayout(request: SendPayoutRequest): Promise<SendPayoutResult> {
    const status: PayoutStatus = request.phone.endsWith('99') ? 'FAILED' : 'SENT';
    const providerReference = `sbx_po_${status.toLowerCase()}_${randomUUID()}`;
    // Never log the phone number.
    this.logger.log(`Sandbox ${request.provider} payout ${providerReference} for ${request.amount} ${request.currency}`);
    return { providerReference, status };
  }

  async getPayoutStatus(providerReference: string): Promise<PayoutStatus> {
    if (providerReference.startsWith('sbx_po_failed_')) return 'FAILED';
    if (providerReference.startsWith('sbx_po_sent_')) return 'SENT';
    return 'PENDING';
  }
}
