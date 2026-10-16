/**
 * Domain enums shared by the API and the mobile app.
 * Values mirror the Prisma enums in apps/api/prisma/schema.prisma.
 */

export const CardStatus = {
  PENDING_FUNDING: 'PENDING_FUNDING',
  ACTIVE: 'ACTIVE',
  FROZEN: 'FROZEN',
  EXPIRED: 'EXPIRED',
  TERMINATED: 'TERMINATED',
} as const;
export type CardStatus = (typeof CardStatus)[keyof typeof CardStatus];

/**
 * Why a card reached TERMINATED. A card whose usage rule is exhausted
 * (e.g. a one-payment card after its first approved payment) is TERMINATED
 * with USAGE_LIMIT_REACHED — there is no separate COMPLETED status.
 */
export const TerminationReason = {
  USER_REQUESTED: 'USER_REQUESTED',
  USAGE_LIMIT_REACHED: 'USAGE_LIMIT_REACHED',
} as const;
export type TerminationReason = (typeof TerminationReason)[keyof typeof TerminationReason];

export const FundingStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;
export type FundingStatus = (typeof FundingStatus)[keyof typeof FundingStatus];

export const TransactionStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  BLOCKED: 'BLOCKED',
  FAILED: 'FAILED',
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const KycStatus = {
  NOT_STARTED: 'NOT_STARTED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];

export const DeclineReason = {
  CARD_NOT_ACTIVE: 'CARD_NOT_ACTIVE',
  CARD_EXPIRED: 'CARD_EXPIRED',
  AMOUNT_LIMIT_EXCEEDED: 'AMOUNT_LIMIT_EXCEEDED',
  TRANSACTION_LIMIT_REACHED: 'TRANSACTION_LIMIT_REACHED',
  MERCHANT_NOT_ALLOWED: 'MERCHANT_NOT_ALLOWED',
} as const;
export type DeclineReason = (typeof DeclineReason)[keyof typeof DeclineReason];

export const MobileMoneyProvider = {
  TMONEY: 'TMONEY',
  FLOOZ: 'FLOOZ',
  MOOV_MONEY: 'MOOV_MONEY',
} as const;
export type MobileMoneyProvider = (typeof MobileMoneyProvider)[keyof typeof MobileMoneyProvider];

/**
 * Refund of the unspent balance once a card has ended.
 * ACTION_REQUIRED: the card was funded with a wallet refunds cannot be sent to (see
 * REFUND_PROVIDERS); the user gives a number on a supported wallet.
 */
export const RefundStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
} as const;
export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];

/** Wallets refunds can be sent to. In Togo, FedaPay sends money to Mixx by Yas (formerly TMoney) only. */
export const REFUND_PROVIDERS: readonly MobileMoneyProvider[] = ['TMONEY'];

/**
 * TMONEY is Togocel's wallet, renamed Mixx by Yas when Togocel became Yas. Flooz and Moov Money are the same
 * Moov Africa wallet: MOOV_MONEY stays for older fundings, the app offers FUNDING_PROVIDERS only.
 */
export const MOBILE_MONEY_PROVIDER_LABELS: Record<MobileMoneyProvider, string> = {
  TMONEY: 'Mixx by Yas',
  FLOOZ: 'Flooz',
  MOOV_MONEY: 'Moov Money',
};

/** Wallets offered when funding a card. */
export const FUNDING_PROVIDERS: readonly MobileMoneyProvider[] = ['TMONEY', 'FLOOZ'];
