import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Funding } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { FundCardInput, FundingDto } from '@mesura/shared';
import { FingerprintService } from '../abuse/fingerprint.service';
import { CardsService } from '../cards/cards.service';
import { PricingService } from '../cards/pricing.service';
import { iso } from '../common/iso';
import { APP_ENV, type AppEnv } from '../config/env';
import { KycService } from '../kyc/kyc.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../providers/payment-provider.interface';

@Injectable()
export class FundingService {
  private readonly logger = new Logger(FundingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: CardsService,
    private readonly pricing: PricingService,
    private readonly kyc: KycService,
    private readonly fingerprints: FingerprintService,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  /** Requests a Mobile Money payment for a draft card. */
  async initiate(userId: string, cardId: string, input: FundCardInput): Promise<FundingDto> {
    const card = await this.cards.findOwned(userId, cardId);
    if (card.status !== 'PENDING_FUNDING' || !card.policy) {
      throw new ConflictException('Cette carte est déjà rechargée');
    }
    if (!(await this.kyc.isVerified(userId))) {
      throw new ForbiddenException('Vérifiez votre identité avant de recharger une carte');
    }

    const freeCard = await this.fingerprints.freeCardAvailable(userId, input.phone);
    const quote = this.pricing.quote(card.policy.maxAmount, card.policy.currency, freeCard);
    await this.fingerprints.recordPhone(userId, input.phone);
    // A new request supersedes any request still waiting on the phone.
    await this.prisma.funding.updateMany({ where: { cardId, status: 'PENDING' }, data: { status: 'EXPIRED' } });

    const payer = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, name: true, kycProfile: { select: { firstName: true, lastName: true } } },
    });
    const initiated = await this.payments.initiateFunding({
      reference: randomUUID(),
      provider: input.provider,
      phone: input.phone,
      amount: quote.total,
      currency: quote.currency,
      description: `Mesura card funding ${card.label}`,
      // Funding requires a verified identity, so the KYC names are set; the account name is a fallback.
      customer: {
        firstName: payer.kycProfile?.firstName ?? payer.name,
        lastName: payer.kycProfile?.lastName ?? payer.name,
        email: payer.email,
      },
    });

    const funding = await this.prisma.funding.create({
      data: {
        userId,
        cardId,
        provider: input.provider,
        providerReference: initiated.providerReference,
        phone: input.phone,
        amount: quote.funding,
        fee: quote.fee,
        freeCard,
        total: quote.total,
        currency: quote.currency,
        status: initiated.status,
      },
    });
    return toDto(funding);
  }

  /** Returns the funding, syncing a pending one with the payment provider first. */
  async get(userId: string, fundingId: string): Promise<FundingDto> {
    const funding = await this.findOwned(userId, fundingId);
    return toDto(await this.sync(funding));
  }

  async findOwned(userId: string, fundingId: string): Promise<Funding> {
    const funding = await this.prisma.funding.findFirst({ where: { id: fundingId, userId } });
    if (!funding) throw new NotFoundException('Paiement introuvable');
    return funding;
  }

  /**
   * Applies the provider's status. On CONFIRMED the card is issued and
   * activated — a card never becomes ACTIVE without a confirmed funding.
   */
  async sync(funding: Funding): Promise<Funding> {
    if (funding.status !== 'PENDING') return funding;

    const expiresAt = funding.createdAt.getTime() + this.env.FUNDING_EXPIRY_MINUTES * 60_000;
    const { status } = await this.payments.getFundingStatus(funding.providerReference);

    if (status === 'CONFIRMED') {
      const claimed = await this.prisma.funding.updateMany({
        where: { id: funding.id, status: 'PENDING' },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });
      if (claimed.count === 1) {
        this.logger.log(`Funding ${funding.id} confirmed`);
        if (funding.freeCard) await this.fingerprints.consumeFreeCard(funding.userId, funding.phone);
        await this.cards.activateAfterFunding(funding.cardId);
      }
    } else if (status === 'FAILED' || status === 'EXPIRED' || Date.now() >= expiresAt) {
      await this.prisma.funding.updateMany({
        where: { id: funding.id, status: 'PENDING' },
        data: { status: status === 'FAILED' ? 'FAILED' : 'EXPIRED' },
      });
    }
    return this.prisma.funding.findUniqueOrThrow({ where: { id: funding.id } });
  }
}

function toDto(funding: Funding): FundingDto {
  return {
    id: funding.id,
    cardId: funding.cardId,
    provider: funding.provider,
    phone: funding.phone,
    amount: funding.amount,
    fee: funding.fee,
    total: funding.total,
    currency: funding.currency,
    status: funding.status,
    createdAt: iso(funding.createdAt),
    confirmedAt: iso(funding.confirmedAt),
  };
}
