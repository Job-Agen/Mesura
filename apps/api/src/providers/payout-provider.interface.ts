import type { Currency, MobileMoneyProvider } from '@mesura/shared';

export type PayoutStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface SendPayoutRequest {
  provider: MobileMoneyProvider;
  phone: string;
  amount: number;
  currency: Currency;
  /** Recipient as known to the aggregator. */
  customer: { firstName: string; lastName: string; email: string };
}

export interface SendPayoutResult {
  providerReference: string;
  status: PayoutStatus;
}

/**
 * Sends money to the user's Mobile Money (refund of a card's unspent balance).
 * Sandbox: SandboxPayoutProvider. FedaPay: FedaPayPayoutProvider, once payouts are enabled on the account.
 */
export interface PayoutProvider {
  sendPayout(request: SendPayoutRequest): Promise<SendPayoutResult>;
  getPayoutStatus(providerReference: string): Promise<PayoutStatus>;
}

export const PAYOUT_PROVIDER = Symbol('PAYOUT_PROVIDER');
