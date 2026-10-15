import { Logger } from '@nestjs/common';
import type { MobileMoneyProvider } from '@mesura/shared';
import type { PayoutProvider, PayoutStatus, SendPayoutRequest, SendPayoutResult } from '../payout-provider.interface';
import { FedaPayClient } from './fedapay-client';

/** FedaPay payout modes for Togo: only TMoney ("togocel") can receive payouts (see REFUND_PROVIDERS). */
const PAYOUT_MODES: Partial<Record<MobileMoneyProvider, string>> = {
  TMONEY: 'togocel',
};

const STATUS: Record<string, PayoutStatus> = {
  pending: 'PENDING',
  scheduled: 'PENDING',
  started: 'PENDING',
  processing: 'PENDING',
  sent: 'SENT',
  failed: 'FAILED',
};

interface FedaPayPayout {
  id: number;
  status: string;
}

/**
 * Sends refunds with FedaPay payouts: create the payout, then start it now (PUT /payouts/start).
 * Payouts must first be enabled on the FedaPay account by FedaPay's support; until then FedaPay
 * answers 403 "Opération non autorisée" and Mesura keeps FEDAPAY_PAYOUTS_ENABLED=false.
 */
export class FedaPayPayoutProvider implements PayoutProvider {
  private readonly logger = new Logger(FedaPayPayoutProvider.name);
  private readonly client: FedaPayClient;

  constructor(secretKey: string) {
    this.client = new FedaPayClient(secretKey);
  }

  async sendPayout(request: SendPayoutRequest): Promise<SendPayoutResult> {
    const mode = PAYOUT_MODES[request.provider];
    if (!mode) throw new Error(`FedaPay cannot send payouts to ${request.provider}`);

    const { 'v1/payout': payout } = await this.client.call<{ 'v1/payout': FedaPayPayout }>('POST', '/payouts', {
      amount: request.amount,
      currency: { iso: request.currency },
      mode,
      customer: {
        firstname: request.customer.firstName,
        lastname: request.customer.lastName,
        email: request.customer.email,
        phone_number: { number: request.phone, country: 'TG' },
      },
    });
    const { 'v1/payouts': started } = await this.client.call<{ 'v1/payouts': FedaPayPayout[] }>('PUT', '/payouts/start', {
      payouts: [{ id: payout.id }],
    });

    // Never log the phone number.
    this.logger.log(`FedaPay ${mode} payout ${payout.id} for ${request.amount} ${request.currency}`);
    return { providerReference: String(payout.id), status: STATUS[started[0]?.status ?? ''] ?? 'PENDING' };
  }

  async getPayoutStatus(providerReference: string): Promise<PayoutStatus> {
    const { 'v1/payout': payout } = await this.client.call<{ 'v1/payout': FedaPayPayout }>(
      'GET',
      `/payouts/${encodeURIComponent(providerReference)}`,
    );
    return STATUS[payout.status] ?? 'PENDING';
  }
}
