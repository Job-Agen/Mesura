/**
 * The sandbox demo account (demo@mesura.test / demo1234): shown to app store reviewers and testers.
 * Used by the seed and by DemoAccountService, which keeps the account usable at every sign-in.
 */
import type { DeclineReason, Prisma, PrismaClient, TransactionStatus } from '@prisma/client';
import { hashPassword } from '../auth/password';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const DEMO_EMAIL = 'demo@mesura.test';
export const DEMO_PASSWORD = 'demo1234';

export const MERCHANTS = [
  { name: 'Canva', slug: 'canva' },
  { name: 'Meta', slug: 'meta' },
  { name: 'Google', slug: 'google' },
  { name: 'OpenAI', slug: 'openai' },
  { name: 'Netflix', slug: 'netflix' },
  { name: 'Amazon', slug: 'amazon' },
];

const FEE_BPS = 500;
const fee = (amount: number): number => Math.floor((amount * FEE_BPS + 5_000) / 10_000);

interface SeedTransaction {
  merchant: string;
  merchantName: string;
  amount: number;
  status: TransactionStatus;
  declineReason?: DeclineReason;
  ago: number;
}

interface SeedCard {
  label: string;
  last4: string;
  status: 'ACTIVE' | 'FROZEN' | 'TERMINATED' | 'EXPIRED';
  terminationReason?: 'USAGE_LIMIT_REACHED' | 'USER_REQUESTED';
  maxAmount: number;
  maxTransactionCount: number | null;
  merchantRestriction: string | null;
  durationMinutes: number;
  activatedAgo: number;
  /** TMoney: the only wallet refunds go to, so a reviewer can delete the demo account without being asked for a number. */
  provider: 'TMONEY';
  transactions: SeedTransaction[];
}

const CARDS: SeedCard[] = [
  {
    label: 'Carte Canva',
    last4: '4821',
    status: 'ACTIVE',
    maxAmount: 15_000,
    maxTransactionCount: 1,
    merchantRestriction: 'canva',
    durationMinutes: 24 * 60,
    activatedAgo: 2 * HOUR,
    provider: 'TMONEY',
    transactions: [
      {
        merchant: 'google',
        merchantName: 'Google',
        amount: 15_255,
        status: 'BLOCKED',
        declineReason: 'AMOUNT_LIMIT_EXCEEDED',
        ago: 90 * MINUTE,
      },
      {
        merchant: 'google',
        merchantName: 'Google',
        amount: 5_000,
        status: 'BLOCKED',
        declineReason: 'MERCHANT_NOT_ALLOWED',
        ago: 40 * MINUTE,
      },
    ],
  },
  {
    label: 'Carte Meta Ads',
    last4: '7310',
    status: 'ACTIVE',
    maxAmount: 50_000,
    maxTransactionCount: null,
    merchantRestriction: 'meta',
    durationMinutes: 30 * 24 * 60,
    activatedAgo: 6 * DAY,
    provider: 'TMONEY',
    transactions: [
      { merchant: 'meta', merchantName: 'Meta', amount: 12_000, status: 'APPROVED', ago: 5 * DAY },
      { merchant: 'meta', merchantName: 'Meta', amount: 9_000, status: 'APPROVED', ago: 3 * DAY },
      { merchant: 'meta', merchantName: 'Meta', amount: 12_000, status: 'APPROVED', ago: 1 * DAY },
      {
        merchant: 'meta',
        merchantName: 'Meta',
        amount: 25_000,
        status: 'BLOCKED',
        declineReason: 'AMOUNT_LIMIT_EXCEEDED',
        ago: 20 * HOUR,
      },
    ],
  },
  {
    label: 'Carte OpenAI',
    last4: '0932',
    status: 'TERMINATED',
    terminationReason: 'USAGE_LIMIT_REACHED',
    maxAmount: 12_000,
    maxTransactionCount: 1,
    merchantRestriction: 'openai',
    durationMinutes: 7 * 24 * 60,
    activatedAgo: 2 * DAY,
    provider: 'TMONEY',
    transactions: [
      { merchant: 'openai', merchantName: 'OpenAI', amount: 11_300, status: 'APPROVED', ago: 2 * DAY - HOUR },
      {
        merchant: 'openai',
        merchantName: 'OpenAI',
        amount: 11_300,
        status: 'BLOCKED',
        declineReason: 'CARD_NOT_ACTIVE',
        ago: 26 * HOUR,
      },
    ],
  },
  {
    label: 'Carte en ligne',
    last4: '5567',
    status: 'FROZEN',
    maxAmount: 25_000,
    maxTransactionCount: 5,
    merchantRestriction: null,
    durationMinutes: 7 * 24 * 60,
    activatedAgo: 1 * DAY,
    provider: 'TMONEY',
    transactions: [
      { merchant: 'netflix', merchantName: 'Netflix', amount: 4_500, status: 'APPROVED', ago: 20 * HOUR },
      {
        merchant: 'amazon',
        merchantName: 'Amazon',
        amount: 8_000,
        status: 'BLOCKED',
        declineReason: 'CARD_NOT_ACTIVE',
        ago: 4 * HOUR,
      },
    ],
  },
];

/** Creates the verified demo user (no cards). */
export async function createDemoUser(prisma: PrismaClient, now = Date.now()): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: 'Koffi',
      phone: '+22890123456',
      passwordHash: await hashPassword(DEMO_PASSWORD),
      termsAcceptedAt: new Date(now - 30 * DAY),
      kycProfile: {
        create: {
          status: 'VERIFIED',
          firstName: 'Koffi',
          lastName: 'Mensah',
          dateOfBirth: new Date('1994-05-17T00:00:00.000Z'),
          country: 'TG',
          providerReference: 'sbx_kyc_seed',
          verifiedAt: new Date(now - 30 * DAY),
        },
      },
    },
  });
  return user.id;
}

/** Replaces the demo user's cards with the demo set, dated relative to now. */
export async function rebuildDemoCards(prisma: PrismaClient | Prisma.TransactionClient, userId: string, now = Date.now()): Promise<void> {
  for (const merchant of MERCHANTS) {
    await prisma.merchant.upsert({ where: { slug: merchant.slug }, create: merchant, update: { name: merchant.name } });
  }
  await prisma.card.deleteMany({ where: { userId } });

  for (const [index, seed] of CARDS.entries()) {
    const activatedAt = new Date(now - seed.activatedAgo);
    const expiresAt = new Date(activatedAt.getTime() + seed.durationMinutes * MINUTE);
    const approved = seed.transactions.filter((t) => t.status === 'APPROVED');

    await prisma.card.create({
      data: {
        userId,
        label: seed.label,
        providerCardId: `sbx_card_seed_${index + 1}`,
        last4: seed.last4,
        status: seed.status,
        terminationReason: seed.terminationReason ?? null,
        createdAt: new Date(activatedAt.getTime() - 2 * MINUTE),
        activatedAt,
        expiresAt,
        policy: {
          create: {
            maxAmount: seed.maxAmount,
            spentAmount: approved.reduce((sum, t) => sum + t.amount, 0),
            maxTransactionCount: seed.maxTransactionCount,
            currentTransactionCount: approved.length,
            merchantRestriction: seed.merchantRestriction,
            durationMinutes: seed.durationMinutes,
            expiresAt,
          },
        },
        fundings: {
          create: {
            userId,
            provider: seed.provider,
            providerReference: `sbx_mm_seed_${index + 1}`,
            phone: '+22890123456',
            amount: seed.maxAmount,
            fee: fee(seed.maxAmount),
            total: seed.maxAmount + fee(seed.maxAmount),
            status: 'CONFIRMED',
            createdAt: new Date(activatedAt.getTime() - MINUTE),
            confirmedAt: activatedAt,
          },
        },
        transactions: {
          create: seed.transactions.map((t) => ({
            merchant: t.merchant,
            merchantName: t.merchantName,
            amount: t.amount,
            status: t.status,
            declineReason: t.declineReason ?? null,
            createdAt: new Date(now - t.ago),
          })),
        },
      },
    });
  }

}
