import type { Prisma } from '@prisma/client';
import type { CardDto, PricingDto } from '@mesura/shared';
import { iso } from '../common/iso';

export const cardInclude = {
  policy: { include: { merchant: true } },
  fundings: { where: { status: 'CONFIRMED' }, orderBy: { confirmedAt: 'desc' }, take: 1 },
  refund: true,
} satisfies Prisma.CardInclude;

export type CardWithRelations = Prisma.CardGetPayload<{ include: typeof cardInclude }>;

export function toCardDto(card: CardWithRelations, quote: (funding: number) => PricingDto): CardDto {
  const policy = card.policy;
  if (!policy) throw new Error(`Card ${card.id} has no policy`);

  const confirmedFunding = card.fundings[0];
  const pricing: PricingDto = confirmedFunding
    ? {
        funding: confirmedFunding.amount,
        fee: confirmedFunding.fee,
        total: confirmedFunding.total,
        currency: confirmedFunding.currency,
        illustrative: true,
      }
    : quote(policy.maxAmount);

  return {
    id: card.id,
    label: card.label,
    last4: card.last4,
    network: 'VISA',
    status: card.status,
    terminationReason: card.terminationReason,
    createdAt: iso(card.createdAt),
    activatedAt: iso(card.activatedAt),
    expiresAt: iso(card.expiresAt),
    policy: {
      maxAmount: policy.maxAmount,
      spentAmount: policy.spentAmount,
      remainingLimit: Math.max(0, policy.maxAmount - policy.spentAmount),
      currency: policy.currency,
      maxTransactionCount: policy.maxTransactionCount,
      currentTransactionCount: policy.currentTransactionCount,
      durationMinutes: policy.durationMinutes,
      merchantRestriction: policy.merchant
        ? { id: policy.merchant.id, name: policy.merchant.name, slug: policy.merchant.slug, iconUrl: policy.merchant.iconUrl }
        : null,
      expiresAt: iso(policy.expiresAt),
    },
    pricing,
    refund: card.refund
      ? {
          id: card.refund.id,
          amount: card.refund.amount,
          currency: card.refund.currency,
          provider: card.refund.provider,
          phone: card.refund.phone,
          status: card.refund.status,
          createdAt: iso(card.refund.createdAt),
          sentAt: iso(card.refund.sentAt),
        }
      : null,
  };
}
