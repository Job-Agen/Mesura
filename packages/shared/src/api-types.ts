import type {
  CardStatus,
  DeclineReason,
  FundingStatus,
  KycStatus,
  MobileMoneyProvider,
  RefundStatus,
  TerminationReason,
  TransactionStatus,
} from './enums';
import type { Currency } from './money';

/** JSON response shapes returned by the API. Dates are ISO-8601 strings. */

export interface UserDto {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  kycStatus: KycStatus;
  createdAt: string;
}

export interface AuthResponseDto {
  accessToken: string;
  user: UserDto;
}

export interface KycProfileDto {
  status: KycStatus;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  country: string | null;
  updatedAt: string | null;
}

export interface MerchantDto {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
}

export interface CardPolicyDto {
  maxAmount: number;
  spentAmount: number;
  remainingLimit: number;
  currency: Currency;
  maxTransactionCount: number | null;
  currentTransactionCount: number;
  durationMinutes: number;
  merchantRestriction: MerchantDto | null;
  expiresAt: string;
}

export interface PricingDto {
  funding: number;
  fee: number;
  total: number;
  currency: Currency;
  /** Placeholder pricing for the sandbox — not a commercial offer. */
  illustrative: true;
}

export interface CardDto {
  id: string;
  label: string;
  /** Sandbox masked representation only — never a real PAN. */
  last4: string | null;
  network: 'VISA';
  status: CardStatus;
  terminationReason: TerminationReason | null;
  createdAt: string;
  activatedAt: string | null;
  expiresAt: string;
  policy: CardPolicyDto;
  pricing: PricingDto;
  /** Refund of the unspent balance, once the card has ended. Null while the card is usable or nothing is left. */
  refund: RefundDto | null;
}

/** Unspent balance sent back to the user's Mobile Money. Fees are not refunded. */
export interface RefundDto {
  id: string;
  amount: number;
  currency: Currency;
  provider: MobileMoneyProvider;
  /** Null while the user has not given a number refunds can be sent to (ACTION_REQUIRED). */
  phone: string | null;
  status: RefundStatus;
  createdAt: string;
  sentAt: string | null;
}

/**
 * Full card details for a one-off display in the app. Never stored by Mesura, never logged.
 * Sandbox: a demo number (demo = true) that no merchant accepts.
 */
export interface CardSecretsDto {
  number: string;
  expiryMonth: number;
  expiryYear: number;
  cvv: string;
  holderName: string;
  demo: boolean;
}

export interface FundingDto {
  id: string;
  cardId: string;
  provider: MobileMoneyProvider;
  phone: string;
  amount: number;
  fee: number;
  total: number;
  currency: Currency;
  status: FundingStatus;
  createdAt: string;
  confirmedAt: string | null;
}

export interface TransactionDto {
  id: string;
  cardId: string;
  cardLabel: string;
  cardLast4: string | null;
  merchant: string;
  merchantName: string;
  amount: number;
  currency: Currency;
  status: TransactionStatus;
  declineReason: DeclineReason | null;
  /** Plain-language explanation for blocked payments. */
  declineMessage: string | null;
  createdAt: string;
}

export interface SimulateTransactionResponseDto {
  status: 'APPROVED' | 'BLOCKED';
  reason?: DeclineReason;
  transaction: TransactionDto;
}

export interface ApiErrorDto {
  statusCode: number;
  message: string;
  issues?: { path: string; message: string }[];
}
