import type { Currency, FundingStatus, MobileMoneyProvider } from '@mesura/shared';

export interface InitiateFundingRequest {
  /** Our internal idempotency reference for this funding attempt. */
  reference: string;
  provider: MobileMoneyProvider;
  phone: string;
  amount: number;
  currency: Currency;
  description: string;
  /** Payer as known to the aggregator (receipts, fraud checks). */
  customer: { firstName: string; lastName: string; email: string };
}

export interface InitiateFundingResult {
  providerReference: string;
  status: FundingStatus;
}

export interface FundingStatusResult {
  status: FundingStatus;
}

/**
 * Collects money from the user (Mobile Money pull payment).
 * Sandbox: SandboxMobileMoneyProvider. Future: a regulated aggregator.
 * The user's Mobile Money PIN is entered on their phone, never in Mesura.
 */
export interface PaymentProvider {
  initiateFunding(request: InitiateFundingRequest): Promise<InitiateFundingResult>;
  getFundingStatus(providerReference: string): Promise<FundingStatusResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
