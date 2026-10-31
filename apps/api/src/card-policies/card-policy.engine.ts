import { Injectable } from '@nestjs/common';
import type { CardStatus, Currency, DeclineReason } from '@mesura/shared';

/** Everything the engine needs to decide — no database, no provider, no clock. */
export interface CardPolicySnapshot {
  status: CardStatus;
  currency: Currency;
  maxAmount: number;
  spentAmount: number;
  /** null = unlimited payments until expiration */
  maxTransactionCount: number | null;
  currentTransactionCount: number;
  expiresAt: Date;
  /** Merchant slug, null = any merchant */
  merchantRestriction: string | null;
}

export interface TransactionAttempt {
  merchant: string;
  amount: number;
  currency: Currency;
}

export type PolicyDecision =
  | { decision: 'APPROVED' }
  | { decision: 'BLOCKED'; reason: DeclineReason };

export interface PolicyUsageUpdate {
  spentAmount: number;
  currentTransactionCount: number;
  /** True when the usage rule is exhausted and the card must be TERMINATED. */
  usageExhausted: boolean;
}

export class InvalidTransactionAttemptError extends Error {}

/** "CANVA", "Canva", " canva " → "canva". Used for merchant matching. */
export function normalizeMerchant(merchant: string): string {
  return merchant.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * How each catalogue merchant shows up on card networks ("NETFLIX.COM", "FACEBK *ADS",
 * "GOOGLE *YouTube"…), as normalized fragments. A merchant without an entry matches its slug.
 */
export const MERCHANT_DESCRIPTORS: Record<string, readonly string[]> = {
  netflix: ['netflix'],
  canva: ['canva'],
  meta: ['facebk', 'facebook', 'meta', 'instagram'],
  google: ['google', 'youtube'],
  openai: ['openai', 'chatgpt'],
  amazon: ['amazon', 'amzn'],
};

/** True when a payment's merchant (as named by the network or the sandbox) is the restricted merchant. */
export function merchantMatches(restriction: string, merchant: string): boolean {
  const slug = normalizeMerchant(restriction);
  const name = normalizeMerchant(merchant);
  if (!slug || !name) return false;
  return name === slug || (MERCHANT_DESCRIPTORS[slug] ?? [slug]).some((fragment) => name.includes(fragment));
}

/** The catalogue merchant a network merchant name belongs to, if any. */
export function catalogueMerchant(merchant: string): string | null {
  return Object.keys(MERCHANT_DESCRIPTORS).find((slug) => merchantMatches(slug, merchant)) ?? null;
}

/**
 * CardPolicyEngine — the core business rules of Mesura.
 *
 * Pure and deterministic: callers pass the policy snapshot, the attempt and
 * the current time. Persistence and concurrency control (row locking) live in
 * the calling service, never here.
 */
@Injectable()
export class CardPolicyEngine {
  /**
   * Evaluation order (first failing rule wins):
   *  1. card ACTIVE?            → CARD_NOT_ACTIVE (CARD_EXPIRED if status is EXPIRED)
   *  2. not expired?            → CARD_EXPIRED
   *  3. transaction count left? → TRANSACTION_LIMIT_REACHED
   *  4. amount within limit?    → AMOUNT_LIMIT_EXCEEDED
   *  5. merchant allowed?       → MERCHANT_NOT_ALLOWED
   *  6. otherwise               → APPROVED
   */
  evaluate(policy: CardPolicySnapshot, attempt: TransactionAttempt, now: Date): PolicyDecision {
    this.assertValidAttempt(policy, attempt);

    if (policy.status !== 'ACTIVE') {
      return blocked(policy.status === 'EXPIRED' ? 'CARD_EXPIRED' : 'CARD_NOT_ACTIVE');
    }
    if (this.isExpired(policy, now)) {
      return blocked('CARD_EXPIRED');
    }
    if (policy.maxTransactionCount !== null && policy.currentTransactionCount >= policy.maxTransactionCount) {
      return blocked('TRANSACTION_LIMIT_REACHED');
    }
    if (attempt.amount > this.remainingLimit(policy)) {
      return blocked('AMOUNT_LIMIT_EXCEEDED');
    }
    if (
      policy.merchantRestriction !== null &&
      !merchantMatches(policy.merchantRestriction, attempt.merchant)
    ) {
      return blocked('MERCHANT_NOT_ALLOWED');
    }
    return { decision: 'APPROVED' };
  }

  /** New counters after an APPROVED transaction. */
  applyApprovedTransaction(policy: CardPolicySnapshot, amount: number): PolicyUsageUpdate {
    const spentAmount = policy.spentAmount + amount;
    const currentTransactionCount = policy.currentTransactionCount + 1;
    if (spentAmount > policy.maxAmount) {
      throw new InvalidTransactionAttemptError('Le montant approuvé dépasse le plafond de la carte');
    }
    return {
      spentAmount,
      currentTransactionCount,
      usageExhausted: policy.maxTransactionCount !== null && currentTransactionCount >= policy.maxTransactionCount,
    };
  }

  remainingLimit(policy: Pick<CardPolicySnapshot, 'maxAmount' | 'spentAmount'>): number {
    return Math.max(0, policy.maxAmount - policy.spentAmount);
  }

  isExpired(policy: Pick<CardPolicySnapshot, 'expiresAt'>, now: Date): boolean {
    return now.getTime() >= policy.expiresAt.getTime();
  }

  private assertValidAttempt(policy: CardPolicySnapshot, attempt: TransactionAttempt): void {
    if (!Number.isInteger(attempt.amount) || attempt.amount <= 0) {
      throw new InvalidTransactionAttemptError('Le montant doit être un entier positif');
    }
    if (attempt.currency !== policy.currency) {
      throw new InvalidTransactionAttemptError(`La devise ${attempt.currency} ne correspond pas à celle de la carte`);
    }
  }
}

function blocked(reason: DeclineReason): PolicyDecision {
  return { decision: 'BLOCKED', reason };
}
