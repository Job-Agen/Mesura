import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { CardDto, CardSecretsDto, CreateCardDraftInput, UpdateCardRulesInput } from '@mesura/shared';
import { KycService } from '../kyc/kyc.service';
import { PrismaService } from '../prisma/prisma.service';
import { CARD_ISSUER_PROVIDER, type CardIssuerProvider } from '../providers/card-issuer-provider.interface';
import { RefundsService } from '../refunds/refunds.service';
import { cardInclude, toCardDto, type CardWithRelations } from './card.presenter';
import { PricingService } from './pricing.service';

const MINUTE_MS = 60_000;

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly kyc: KycService,
    private readonly refunds: RefundsService,
    @Inject(CARD_ISSUER_PROVIDER) private readonly issuer: CardIssuerProvider,
  ) {}

  /** Cards the user has funded (drafts waiting for funding are not listed). */
  async list(userId: string): Promise<CardDto[]> {
    await this.settle(userId);
    const cards = await this.prisma.card.findMany({
      where: { userId, status: { not: 'PENDING_FUNDING' } },
      include: cardInclude,
      orderBy: { createdAt: 'desc' },
    });
    return cards.map((c) => this.present(c));
  }

  async get(userId: string, cardId: string): Promise<CardDto> {
    await this.settle(userId);
    return this.present(await this.findOwned(userId, cardId));
  }

  async createDraft(userId: string, input: CreateCardDraftInput): Promise<CardDto> {
    let merchantName: string | null = null;
    if (input.merchantRestriction !== null) {
      const merchant = await this.prisma.merchant.findUnique({ where: { slug: input.merchantRestriction } });
      if (!merchant) throw new BadRequestException('Marchand inconnu');
      merchantName = merchant.name;
    }

    // Provisional expiry; it is recomputed from durationMinutes at activation.
    const expiresAt = new Date(Date.now() + input.durationMinutes * MINUTE_MS);
    const card = await this.prisma.card.create({
      data: {
        userId,
        label: input.label ?? (merchantName ? `Carte ${merchantName}` : 'Carte en ligne'),
        status: 'PENDING_FUNDING',
        expiresAt,
        policy: {
          create: {
            maxAmount: input.maxAmount,
            currency: input.currency,
            maxTransactionCount: input.maxTransactionCount,
            merchantRestriction: input.merchantRestriction,
            durationMinutes: input.durationMinutes,
            expiresAt,
          },
        },
      },
      include: cardInclude,
    });
    return this.present(card);
  }

  /**
   * Issues the card with the issuer and activates it. Called only once the
   * funding is CONFIRMED. Idempotent: an already-issued card is returned as is.
   */
  async activateAfterFunding(cardId: string): Promise<void> {
    const card = await this.prisma.card.findUnique({ where: { id: cardId }, include: cardInclude });
    if (!card?.policy) throw new NotFoundException('Carte introuvable');
    if (card.status !== 'PENDING_FUNDING') return;
    if (!(await this.kyc.isVerified(card.userId))) {
      throw new ForbiddenException("Vérifiez votre identité avant d'activer une carte");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + card.policy.durationMinutes * MINUTE_MS);
    const issued = await this.issuer.createCard({
      cardId: card.id,
      userId: card.userId,
      label: card.label,
      expiresAt,
      limitXof: card.policy.maxAmount,
    });

    const updated = await this.prisma.card.updateMany({
      where: { id: card.id, status: 'PENDING_FUNDING' },
      data: {
        status: 'ACTIVE',
        providerCardId: issued.providerCardId,
        last4: issued.last4,
        activatedAt: now,
        expiresAt,
      },
    });
    if (updated.count === 0) {
      // A concurrent activation won; release the duplicate issuer card.
      await this.issuer.terminateCard(issued.providerCardId);
      return;
    }
    await this.prisma.cardPolicy.update({ where: { cardId: card.id }, data: { expiresAt } });
  }

  async freeze(userId: string, cardId: string): Promise<CardDto> {
    const card = await this.findOwned(userId, cardId);
    if (card.status !== 'ACTIVE') throw new ConflictException('Seule une carte active peut être gelée');
    await this.transition(card, 'ACTIVE', { status: 'FROZEN' });
    if (card.providerCardId) await this.issuer.freezeCard(card.providerCardId);
    return this.get(userId, cardId);
  }

  async unfreeze(userId: string, cardId: string): Promise<CardDto> {
    const card = await this.findOwned(userId, cardId);
    if (card.status !== 'FROZEN') throw new ConflictException('Seule une carte gelée peut être dégelée');
    await this.transition(card, 'FROZEN', { status: 'ACTIVE' });
    if (card.providerCardId) await this.issuer.unfreezeCard(card.providerCardId);
    return this.get(userId, cardId);
  }

  async terminate(userId: string, cardId: string): Promise<CardDto> {
    const card = await this.findOwned(userId, cardId);
    if (card.status === 'TERMINATED') return this.present(card);
    await this.transition(card, card.status, { status: 'TERMINATED', terminationReason: 'USER_REQUESTED' });
    if (card.providerCardId) await this.issuer.terminateCard(card.providerCardId);
    return this.get(userId, cardId);
  }

  async redirectRefund(userId: string, cardId: string, phone: string): Promise<CardDto> {
    await this.findOwned(userId, cardId);
    await this.refunds.redirect(userId, cardId, phone);
    return this.get(userId, cardId);
  }

  /**
   * Before an account is deleted: closes its usable cards and refunds what they hold. Returns the
   * amount still waiting for a number to be sent to (it would be lost with the account).
   */
  async closeAllForDeletion(userId: string): Promise<number> {
    const open = await this.prisma.card.findMany({ where: { userId, status: { in: ['ACTIVE', 'FROZEN'] } } });
    for (const card of open) {
      const { count } = await this.prisma.card.updateMany({
        where: { id: card.id, status: card.status },
        data: { status: 'TERMINATED', terminationReason: 'USER_REQUESTED' },
      });
      if (count === 1 && card.providerCardId) await this.issuer.terminateCard(card.providerCardId);
    }
    await this.settle(userId);
    const waiting = await this.prisma.refund.aggregate({
      where: { card: { userId }, status: { in: ['ACTION_REQUIRED', 'FAILED'] } },
      _sum: { amount: true },
    });
    return waiting._sum.amount ?? 0;
  }

  /** Rules can only be tightened: a lower limit or fewer payments, never more. */
  async updateRules(userId: string, cardId: string, input: UpdateCardRulesInput): Promise<CardDto> {
    const card = await this.findOwned(userId, cardId);
    const policy = card.policy;
    if (!policy) throw new NotFoundException('Carte introuvable');
    if (card.status !== 'ACTIVE' && card.status !== 'FROZEN') {
      throw new ConflictException('Les règles ne peuvent être modifiées que sur une carte active ou gelée');
    }

    if (input.maxAmount !== undefined) {
      if (input.maxAmount > policy.maxAmount) throw new BadRequestException('Le plafond ne peut être que réduit');
      if (input.maxAmount < policy.spentAmount) {
        throw new BadRequestException('Le plafond ne peut pas être inférieur au montant déjà dépensé');
      }
    }
    if (input.maxTransactionCount !== undefined) {
      if (policy.maxTransactionCount !== null && input.maxTransactionCount > policy.maxTransactionCount) {
        throw new BadRequestException('Le nombre de paiements ne peut être que réduit');
      }
      if (input.maxTransactionCount <= policy.currentTransactionCount) {
        throw new BadRequestException('Autorisez au moins un paiement de plus, ou clôturez plutôt la carte');
      }
    }

    await this.prisma.cardPolicy.update({
      where: { cardId: card.id },
      data: { maxAmount: input.maxAmount, maxTransactionCount: input.maxTransactionCount },
    });
    return this.get(userId, cardId);
  }

  /**
   * Full card details for the "show card details" screen. Only usable cards are revealed; the
   * result is returned once and never stored or logged.
   */
  async reveal(userId: string, cardId: string): Promise<CardSecretsDto> {
    await this.expireOverdueCards(userId);
    const card = await this.findOwned(userId, cardId);
    if ((card.status !== 'ACTIVE' && card.status !== 'FROZEN') || !card.providerCardId || !card.last4) {
      throw new ConflictException("Les informations ne sont disponibles que pour une carte active ou gelée");
    }
    const [secrets, kyc] = await Promise.all([
      this.issuer.revealCard(card.providerCardId, card.last4, card.expiresAt),
      this.prisma.kycProfile.findUnique({ where: { userId }, select: { firstName: true, lastName: true } }),
    ]);
    const holderName = [kyc?.firstName, kyc?.lastName].filter(Boolean).join(' ').toUpperCase();
    return {
      number: secrets.pan,
      expiryMonth: secrets.expiryMonth,
      expiryYear: secrets.expiryYear,
      cvv: secrets.cvv,
      holderName,
      demo: secrets.demo,
    };
  }

  /** Loads a card owned by the user. Other users' cards are reported as not found. */
  async findOwned(userId: string, cardId: string): Promise<CardWithRelations> {
    const card = await this.prisma.card.findFirst({ where: { id: cardId, userId }, include: cardInclude });
    if (!card) throw new NotFoundException('Carte introuvable');
    return card;
  }

  present(card: CardWithRelations): CardDto {
    return toCardDto(card, (funding) => this.pricing.quote(funding, card.policy?.currency ?? 'XOF'));
  }

  /** Brings the user's cards up to date: expiry, then refunds of the cards that have ended. */
  private async settle(userId: string): Promise<void> {
    await this.expireOverdueCards(userId);
    await this.refunds.settle(userId);
  }

  /** Lazily moves cards past their expiry to EXPIRED. */
  private async expireOverdueCards(userId: string): Promise<void> {
    const { count } = await this.prisma.card.updateMany({
      where: { userId, status: { in: ['ACTIVE', 'FROZEN'] }, expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
    if (count > 0) this.logger.log(`Expired ${count} card(s)`);
  }

  /** Compare-and-set status change, so concurrent requests cannot both win. */
  private async transition(
    card: CardWithRelations,
    from: CardWithRelations['status'],
    data: { status: CardWithRelations['status']; terminationReason?: 'USER_REQUESTED' },
  ): Promise<void> {
    const { count } = await this.prisma.card.updateMany({ where: { id: card.id, status: from }, data });
    if (count === 0) throw new ConflictException('La carte a changé entre-temps. Réessayez.');
  }
}
