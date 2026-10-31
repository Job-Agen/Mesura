import {
  CardPolicyEngine,
  catalogueMerchant,
  merchantMatches,
  InvalidTransactionAttemptError,
  normalizeMerchant,
  type CardPolicySnapshot,
  type TransactionAttempt,
} from './card-policy.engine';

const NOW = new Date('2026-01-12T10:00:00.000Z');
const IN_24H = new Date('2026-01-13T10:00:00.000Z');

function policy(overrides: Partial<CardPolicySnapshot> = {}): CardPolicySnapshot {
  return {
    status: 'ACTIVE',
    currency: 'XOF',
    maxAmount: 15_000,
    spentAmount: 0,
    maxTransactionCount: 1,
    currentTransactionCount: 0,
    expiresAt: IN_24H,
    merchantRestriction: 'canva',
    ...overrides,
  };
}

function attempt(overrides: Partial<TransactionAttempt> = {}): TransactionAttempt {
  return { merchant: 'CANVA', amount: 5_650, currency: 'XOF', ...overrides };
}

describe('CardPolicyEngine', () => {
  const engine = new CardPolicyEngine();

  it('1. approves a valid transaction', () => {
    expect(engine.evaluate(policy(), attempt(), NOW)).toEqual({ decision: 'APPROVED' });
  });

  it('2. blocks an amount above the remaining limit', () => {
    expect(engine.evaluate(policy(), attempt({ amount: 15_001 }), NOW)).toEqual({
      decision: 'BLOCKED',
      reason: 'AMOUNT_LIMIT_EXCEEDED',
    });
    // Remaining limit accounts for what was already spent.
    const partlySpent = policy({ maxTransactionCount: 5, currentTransactionCount: 1, spentAmount: 10_000 });
    expect(engine.evaluate(partlySpent, attempt({ amount: 5_001 }), NOW)).toEqual({
      decision: 'BLOCKED',
      reason: 'AMOUNT_LIMIT_EXCEEDED',
    });
    expect(engine.evaluate(partlySpent, attempt({ amount: 5_000 }), NOW)).toEqual({ decision: 'APPROVED' });
  });

  it('3. blocks an expired card (by clock and by status)', () => {
    expect(engine.evaluate(policy({ expiresAt: NOW }), attempt(), NOW)).toEqual({
      decision: 'BLOCKED',
      reason: 'CARD_EXPIRED',
    });
    expect(engine.evaluate(policy({ status: 'EXPIRED' }), attempt(), NOW)).toEqual({
      decision: 'BLOCKED',
      reason: 'CARD_EXPIRED',
    });
  });

  it('4. blocks a frozen card (and any non-active card)', () => {
    for (const status of ['FROZEN', 'TERMINATED', 'PENDING_FUNDING'] as const) {
      expect(engine.evaluate(policy({ status }), attempt(), NOW)).toEqual({
        decision: 'BLOCKED',
        reason: 'CARD_NOT_ACTIVE',
      });
    }
  });

  it('5. blocks a merchant other than the restricted one', () => {
    expect(engine.evaluate(policy(), attempt({ merchant: 'GOOGLE' }), NOW)).toEqual({
      decision: 'BLOCKED',
      reason: 'MERCHANT_NOT_ALLOWED',
    });
    // Unrestricted cards accept any merchant.
    expect(engine.evaluate(policy({ merchantRestriction: null }), attempt({ merchant: 'GOOGLE' }), NOW)).toEqual({
      decision: 'APPROVED',
    });
  });

  it('6. blocks when the max transaction count is reached', () => {
    const used = policy({ maxTransactionCount: 5, currentTransactionCount: 5, spentAmount: 5_000 });
    expect(engine.evaluate(used, attempt({ amount: 100 }), NOW)).toEqual({
      decision: 'BLOCKED',
      reason: 'TRANSACTION_LIMIT_REACHED',
    });
    // "Until expiration" cards have no count limit.
    const unlimited = policy({ maxTransactionCount: null, currentTransactionCount: 42, spentAmount: 5_000 });
    expect(engine.evaluate(unlimited, attempt({ amount: 100 }), NOW)).toEqual({ decision: 'APPROVED' });
  });

  it('7. a one-payment card stops accepting payments after the first success', () => {
    const oneShot = policy({ maxTransactionCount: 1 });
    expect(engine.evaluate(oneShot, attempt(), NOW)).toEqual({ decision: 'APPROVED' });

    const update = engine.applyApprovedTransaction(oneShot, 5_650);
    expect(update.usageExhausted).toBe(true);

    // Even before the card status is switched to TERMINATED, the counters block a second payment.
    const afterFirst = policy({ ...update, maxTransactionCount: 1 });
    expect(engine.evaluate(afterFirst, attempt({ amount: 100 }), NOW)).toEqual({
      decision: 'BLOCKED',
      reason: 'TRANSACTION_LIMIT_REACHED',
    });
    // And once TERMINATED it is blocked as not active.
    expect(engine.evaluate({ ...afterFirst, status: 'TERMINATED' }, attempt(), NOW)).toEqual({
      decision: 'BLOCKED',
      reason: 'CARD_NOT_ACTIVE',
    });
  });

  it('8. updates spent amount and count correctly on approval', () => {
    const multi = policy({ maxTransactionCount: 5, spentAmount: 2_000, currentTransactionCount: 1 });
    const update = engine.applyApprovedTransaction(multi, 5_650);
    expect(update).toEqual({ spentAmount: 7_650, currentTransactionCount: 2, usageExhausted: false });
    expect(engine.remainingLimit({ maxAmount: 15_000, spentAmount: update.spentAmount })).toBe(7_350);
  });

  it('follows the documented evaluation order', () => {
    // Frozen + expired + count reached + over limit + wrong merchant → status wins.
    const everythingWrong = policy({
      status: 'FROZEN',
      expiresAt: NOW,
      currentTransactionCount: 1,
    });
    expect(engine.evaluate(everythingWrong, attempt({ amount: 99_999, merchant: 'NETFLIX' }), NOW)).toEqual({
      decision: 'BLOCKED',
      reason: 'CARD_NOT_ACTIVE',
    });
    // Count reached is reported before amount and merchant.
    expect(
      engine.evaluate(policy({ currentTransactionCount: 1 }), attempt({ amount: 99_999, merchant: 'NETFLIX' }), NOW),
    ).toEqual({ decision: 'BLOCKED', reason: 'TRANSACTION_LIMIT_REACHED' });
    // Amount is reported before merchant.
    expect(engine.evaluate(policy(), attempt({ amount: 99_999, merchant: 'NETFLIX' }), NOW)).toEqual({
      decision: 'BLOCKED',
      reason: 'AMOUNT_LIMIT_EXCEEDED',
    });
  });

  it('rejects zero, negative, fractional amounts and currency mismatches', () => {
    for (const amount of [0, -100, 10.5]) {
      expect(() => engine.evaluate(policy(), attempt({ amount }), NOW)).toThrow(InvalidTransactionAttemptError);
    }
    expect(() =>
      engine.evaluate(policy(), { ...attempt(), currency: 'USD' as unknown as 'XOF' }, NOW),
    ).toThrow(InvalidTransactionAttemptError);
  });

  it('normalises merchant identifiers', () => {
    expect(normalizeMerchant(' Open AI ')).toBe('openai');
    expect(normalizeMerchant('CANVA')).toBe('canva');
  });
});

describe('merchant matching on card networks', () => {
  it('recognises network descriptors of catalogue merchants', () => {
    expect(merchantMatches('netflix', 'NETFLIX.COM')).toBe(true);
    expect(merchantMatches('meta', 'FACEBK *ADS 7Q2X')).toBe(true);
    expect(merchantMatches('google', 'GOOGLE *YouTube Premium')).toBe(true);
    expect(merchantMatches('amazon', 'AMZN Mktp FR')).toBe(true);
    expect(merchantMatches('canva', 'Canva')).toBe(true);
    expect(merchantMatches('netflix', 'SPOTIFY AB')).toBe(false);
    expect(merchantMatches('canva', '')).toBe(false);
  });

  it('names the catalogue merchant behind a descriptor', () => {
    expect(catalogueMerchant('OPENAI *CHATGPT SUBSCR')).toBe('openai');
    expect(catalogueMerchant('Boutique Lomé')).toBeNull();
  });
});
