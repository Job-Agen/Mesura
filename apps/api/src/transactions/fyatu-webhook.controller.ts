import { Controller, Headers, HttpCode, Inject, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { DeclineReason } from '@mesura/shared';
import { Public } from '../common/auth-user';
import { APP_ENV, type AppEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { usdToXof } from '../providers/fyatu/fyatu-card-issuer.provider';
import { verifyFyatuSignature } from '../providers/fyatu/fyatu-crypto';
import { TransactionsService } from './transactions.service';

interface FyatuEvent {
  event?: string;
  eventId?: string;
  data?: Record<string, unknown>;
}

export type FyatuDecision = { decision: 'APPROVE' } | { decision: 'DECLINE'; reason: string };

/** Mesura's decline reasons in Fyatu's vocabulary (CARD_AUTHORIZATION_VERIFY). */
const FYATU_DECLINE: Record<DeclineReason, string> = {
  CARD_NOT_ACTIVE: 'RESTRICTED',
  CARD_EXPIRED: 'RESTRICTED',
  AMOUNT_LIMIT_EXCEEDED: 'VELOCITY_EXCEED',
  TRANSACTION_LIMIT_REACHED: 'VELOCITY_EXCEED',
  MERCHANT_NOT_ALLOWED: 'INVALID_MERCHANT',
};

const DECLINE_GENERIC: FyatuDecision = { decision: 'DECLINE', reason: 'DO_NOT_HONOUR' };

/**
 * Fyatu webhooks. CARD_AUTHORIZATION_VERIFY is synchronous: Fyatu asks Mesura to approve each
 * payment and needs the answer within 1.2 s. Fyatu approves when the answer is late, not 2xx or
 * unreadable, so every doubtful case here answers 200 with a decline rather than an error.
 */
@Public()
@SkipThrottle()
@Controller('webhooks/fyatu')
export class FyatuWebhookController {
  private readonly logger = new Logger(FyatuWebhookController.name);

  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
  ) {}

  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>, @Headers('x-fyatu-signature') signature: string | undefined): Promise<unknown> {
    const raw = req.rawBody;
    const event = (req.body ?? {}) as FyatuEvent;
    const isAuthorization = event.event === 'CARD_AUTHORIZATION_VERIFY';
    const authentic = !!raw && !!this.env.FYATU_API_KEY && verifyFyatuSignature(raw, signature, this.env.FYATU_WEBHOOK_SECRET);

    if (!authentic) {
      this.logger.warn(`Fyatu webhook with an invalid signature (${event.event ?? 'unknown event'})`);
      // An authorization must still get a 200 decline: an error would make Fyatu approve it.
      if (isAuthorization) return DECLINE_GENERIC;
      throw new UnauthorizedException();
    }
    if (isAuthorization) return this.decide(event);

    if (event.event === 'CARD_ISSUED') await this.recordIssuedCard(event.data ?? {});
    else this.logger.log(`Fyatu event ${event.event ?? 'unknown'}`);
    return { received: true };
  }

  /** Runs Mesura's rules on a real payment attempt and answers in Fyatu's format. */
  async decide(event: FyatuEvent): Promise<FyatuDecision> {
    try {
      const data = event.data ?? {};
      const card = await this.prisma.card.findUnique({ where: { providerCardId: String(data.cardId ?? '') } });
      if (!card) return { decision: 'DECLINE', reason: 'RESTRICTED' };

      // Adding the card to Apple Pay / Google Pay: allowed for a usable card only.
      if (data.type === 'AUTHORIZATION_VERIFY') {
        return card.status === 'ACTIVE' ? { decision: 'APPROVE' } : { decision: 'DECLINE', reason: 'RESTRICTED' };
      }

      const amountUsd = Number(data.amount ?? 0) + Number(data.feeAmount ?? 0);
      const result = await this.transactions.authorizeCard({
        cardId: card.id,
        merchant: String(data.merchantName ?? '').trim() || 'Marchand inconnu',
        amount: usdToXof(amountUsd, this.env.FYATU_XOF_PER_USD),
        currency: 'XOF',
        providerReference: event.eventId ? String(event.eventId) : undefined,
      });
      return result.status === 'APPROVED' ? { decision: 'APPROVE' } : { decision: 'DECLINE', reason: result.reason ? FYATU_DECLINE[result.reason] : 'DO_NOT_HONOUR' };
    } catch (error) {
      this.logger.error(`Fyatu authorization declined after an error: ${error instanceof Error ? error.message : 'unknown'}`);
      return DECLINE_GENERIC;
    }
  }

  /** The card number arrives after issuing when Fyatu provisions asynchronously. */
  private async recordIssuedCard(data: Record<string, unknown>): Promise<void> {
    const providerCardId = String(data.cardId ?? data.id ?? '');
    const last4 = typeof data.last4 === 'string' && /^\d{4}$/.test(data.last4) ? data.last4 : null;
    if (!providerCardId || !last4) return;
    await this.prisma.card.updateMany({ where: { providerCardId, last4: null }, data: { last4 } });
  }
}
