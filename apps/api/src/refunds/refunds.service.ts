import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type Refund } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { REFUND_PROVIDERS } from '@mesura/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PAYOUT_PROVIDER, type PayoutProvider } from '../providers/payout-provider.interface';

/** What is left on a card: the amount funded minus what was spent. The service fee is not refunded. */
export function refundableBalance(funded: number, spent: number): number {
  return Math.max(0, funded - spent);
}

/** Marks a refund as being sent by this request, so two requests cannot send it twice. */
const CLAIM_PREFIX = 'claim_';

/**
 * Sends a card's unspent balance back to Mobile Money once the card has ended (closed, used up or
 * expired). It goes to the number that funded the card when that wallet can receive payouts;
 * otherwise the user gives a number on a wallet that can (ACTION_REQUIRED).
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYOUT_PROVIDER) private readonly payouts: PayoutProvider,
  ) {}

  /** Opens refunds for the user's ended cards that still hold money, and moves pending ones along. */
  async settle(userId: string): Promise<void> {
    const ended = await this.prisma.card.findMany({
      where: { userId, status: { in: ['TERMINATED', 'EXPIRED'] }, refund: null, fundings: { some: { status: 'CONFIRMED' } } },
      include: { policy: true, fundings: { where: { status: 'CONFIRMED' }, orderBy: { confirmedAt: 'desc' }, take: 1 } },
    });
    for (const card of ended) {
      const funding = card.fundings[0];
      if (!funding || !card.policy) continue;
      const amount = refundableBalance(funding.amount, card.policy.spentAmount);
      if (amount > 0) await this.open(card.id, amount, funding.currency, funding.provider, funding.phone);
    }

    const pending = await this.prisma.refund.findMany({ where: { status: 'PENDING', card: { userId } } });
    for (const refund of pending) await this.sync(refund);
  }

  /** Sends a refund that could not be sent (unsupported wallet, failed payout) to a number the user gives. */
  async redirect(userId: string, cardId: string, phone: string): Promise<void> {
    const refund = await this.prisma.refund.findFirst({ where: { cardId, card: { userId } } });
    if (!refund) throw new NotFoundException("Aucun remboursement n'est prévu pour cette carte");
    const provider = REFUND_PROVIDERS[0] ?? 'TMONEY';
    const { count } = await this.prisma.refund.updateMany({
      where: { id: refund.id, status: { in: ['ACTION_REQUIRED', 'FAILED'] } },
      data: { provider, phone, status: 'PENDING', providerReference: null },
    });
    if (count === 0) throw new ConflictException('Ce remboursement est déjà en cours ou envoyé');
    await this.send(refund.id);
  }

  private async open(
    cardId: string,
    amount: number,
    currency: Refund['currency'],
    provider: Refund['provider'],
    phone: string,
  ): Promise<void> {
    const supported = REFUND_PROVIDERS.includes(provider);
    let refund: Refund;
    try {
      refund = await this.prisma.refund.create({
        data: {
          cardId,
          amount,
          currency,
          provider,
          phone: supported ? phone : null,
          status: supported ? 'PENDING' : 'ACTION_REQUIRED',
        },
      });
    } catch (error) {
      // Another request opened it first.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
    this.logger.log(`Refund ${refund.id} opened for ${amount} ${currency} (${refund.status})`);
    if (supported) await this.send(refund.id).catch(() => undefined);
  }

  private async sync(refund: Refund): Promise<void> {
    if (refund.providerReference === null) {
      await this.send(refund.id).catch(() => undefined);
      return;
    }
    // Being sent by another request (or a request that died mid-send: left for support to check).
    if (refund.providerReference.startsWith(CLAIM_PREFIX)) return;
    const status = await this.payouts.getPayoutStatus(refund.providerReference).catch(() => 'PENDING' as const);
    if (status !== 'PENDING') {
      await this.prisma.refund.updateMany({
        where: { id: refund.id, status: 'PENDING' },
        data: { status, sentAt: status === 'SENT' ? new Date() : null },
      });
    }
  }

  /** Claims a pending refund that has not been sent yet, then sends it. Throws if the payout cannot be requested. */
  private async send(refundId: string): Promise<void> {
    const claim = `${CLAIM_PREFIX}${randomUUID()}`;
    const { count } = await this.prisma.refund.updateMany({
      where: { id: refundId, status: 'PENDING', providerReference: null },
      data: { providerReference: claim },
    });
    if (count === 0) return;

    const refund = await this.prisma.refund.findUniqueOrThrow({
      where: { id: refundId },
      include: { card: { select: { user: { select: { email: true, name: true, kycProfile: true } } } } },
    });
    const user = refund.card.user;
    try {
      const result = await this.payouts.sendPayout({
        provider: refund.provider,
        phone: refund.phone ?? '',
        amount: refund.amount,
        currency: refund.currency,
        customer: {
          firstName: user.kycProfile?.firstName ?? user.name,
          lastName: user.kycProfile?.lastName ?? user.name,
          email: user.email,
        },
      });
      await this.prisma.refund.update({
        where: { id: refundId },
        data: {
          providerReference: result.providerReference,
          status: result.status,
          sentAt: result.status === 'SENT' ? new Date() : null,
        },
      });
    } catch (error) {
      // Not requested: release the claim so the next visit retries it.
      await this.prisma.refund.update({ where: { id: refundId }, data: { providerReference: null } });
      this.logger.error(`Refund ${refundId} could not be sent: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
