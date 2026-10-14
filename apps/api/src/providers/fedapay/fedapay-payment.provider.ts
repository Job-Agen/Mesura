import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { FundingStatus, MobileMoneyProvider } from '@mesura/shared';
import type {
  FundingStatusResult,
  InitiateFundingRequest,
  InitiateFundingResult,
  PaymentProvider,
} from '../payment-provider.interface';

/** FedaPay modes for Togo: T-Money is "togocel"; Flooz is Moov Africa Togo's wallet ("moov_tg"). */
const LIVE_MODES: Record<MobileMoneyProvider, string> = {
  TMONEY: 'togocel',
  FLOOZ: 'moov_tg',
  MOOV_MONEY: 'moov_tg',
};

/**
 * FedaPay's sandbox no longer simulates operators: every test payment goes through "momo_test",
 * approved for its test number and declined for any other. A Togolese number ending in 99 is sent
 * as is, so it is declined: that is how a failed payment is tried in the app.
 */
const SANDBOX_MODE = 'momo_test';
const SANDBOX_APPROVED_PHONE = { number: '64000001', country: 'BJ' };

const STATUS: Record<string, FundingStatus> = {
  pending: 'PENDING',
  approved: 'CONFIRMED',
  transferred: 'CONFIRMED',
  // Not final at FedaPay (the payment can be retried), but each Mesura attempt is a new transaction.
  declined: 'FAILED',
  canceled: 'FAILED',
  expired: 'EXPIRED',
};

interface FedaPayTransaction {
  id: number;
  status: string;
}

/**
 * Collects card fundings with FedaPay (https://docs.fedapay.com): create a transaction, get its
 * token, then push the payment request to the customer's phone, where they approve it with their
 * Mobile Money PIN. Mesura never sees the PIN.
 */
export class FedaPayPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(FedaPayPaymentProvider.name);
  private readonly baseUrl: string;
  private readonly sandbox: boolean;

  constructor(private readonly secretKey: string) {
    this.sandbox = secretKey.startsWith('sk_sandbox_');
    this.baseUrl = this.sandbox ? 'https://sandbox-api.fedapay.com/v1' : 'https://api.fedapay.com/v1';
  }

  async initiateFunding(request: InitiateFundingRequest): Promise<InitiateFundingResult> {
    const phone = { number: request.phone, country: 'TG' };
    const { 'v1/transaction': transaction } = await this.call<{ 'v1/transaction': FedaPayTransaction }>(
      'POST',
      '/transactions',
      {
        description: request.description,
        amount: request.amount,
        currency: { iso: request.currency },
        merchant_reference: request.reference,
        customer: {
          firstname: request.customer.firstName,
          lastname: request.customer.lastName,
          email: request.customer.email,
          phone_number: phone,
        },
      },
    );
    const { token } = await this.call<{ token: string }>('POST', `/transactions/${transaction.id}/token`);

    const sandboxPhone = request.phone.endsWith('99') ? phone : SANDBOX_APPROVED_PHONE;
    const mode = this.sandbox ? SANDBOX_MODE : LIVE_MODES[request.provider];
    await this.call('POST', `/${mode}`, { token, phone_number: this.sandbox ? sandboxPhone : phone });

    // Never log the phone number.
    this.logger.log(`FedaPay ${this.sandbox ? 'sandbox' : 'live'} ${mode} request ${transaction.id} for ${request.amount} ${request.currency}`);
    return { providerReference: String(transaction.id), status: 'PENDING' };
  }

  async getFundingStatus(providerReference: string): Promise<FundingStatusResult> {
    const { 'v1/transaction': transaction } = await this.call<{ 'v1/transaction': FedaPayTransaction }>(
      'GET',
      `/transactions/${encodeURIComponent(providerReference)}`,
    );
    return { status: STATUS[transaction.status] ?? 'PENDING' };
  }

  private async call<T = unknown>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // The body may echo customer data: log the status only.
      this.logger.error(`FedaPay ${method} ${path.split('/')[1]} failed with HTTP ${response.status}`);
      throw new ServiceUnavailableException('Le service Mobile Money ne répond pas. Réessayez dans un instant.');
    }
    return (await response.json()) as T;
  }
}
