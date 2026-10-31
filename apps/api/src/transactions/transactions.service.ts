import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { SimulateTransactionInput, SimulateTransactionResponseDto, TransactionDto, TransactionFilterInput } from '@mesura/shared';
import {
  CardPolicyEngine,
  catalogueMerchant,
  InvalidTransactionAttemptError,
  normalizeMerchant,
  type PolicyDecision,
} from '../card-policies/card-policy.engine';
import { PrismaService } from '../prisma/prisma.service';
import { CARD_ISSUER_PROVIDER, type CardIssuerProvider } from '../providers/card-issuer-provider.interface';
import { toTransactionDto, transactionInclude } from './transaction.presenter';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: CardPolicyEngine,
    @Inject(CARD_ISSUER_PROVIDER) private readonly issuer: CardIssuerProvider,
  ) {}

  async list(userId: string, filter: TransactionFilterInput): Promise<TransactionDto[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        card: { userId },
        ...(filter.cardId ? { cardId: filter.cardId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      include: transactionInclude,
      orderBy: { createdAt: 'desc' },
      take: filter.limit,
    });
    return transactions.map(toTransactionDto);
  }

  async get(userId: string, id: string): Promise<TransactionDto> {
    const tx = await this.prisma.transaction.findFirst({ where: { id, card: { userId } }, include: transactionInclude });
    if (!tx) throw new NotFoundException('Transaction introuvable');
    return toTransactionDto(tx);
  }

  /** A payment simulated by the card's owner (sandbox). */
  authorize(userId: string, input: SimulateTransactionInput): Promise<SimulateTransactionResponseDto> {
    return this.authorizeCard({ ...input, userId });
  }

  /**
   * Authorizes a merchant payment attempt against the card's policy: a sandbox simulation (with
   * the owner's id) or a real authorization asked by the card issuer (with its event id, so a
   * retried delivery gets the same answer). The card row is locked (SELECT … FOR UPDATE) so
   * concurrent attempts are evaluated one at a time and can never overspend the limit.
   */
  async authorizeCard(input: AuthorizationAttempt): Promise<SimulateTransactionResponseDto> {
    const merchantSlug = catalogueMerchant(input.merchant) ?? normalizeMerchant(input.merchant);
    if (!merchantSlug) throw new BadRequestException('Saisissez le nom du marchand');

    if (input.providerReference) {
      const seen = await this.prisma.transaction.findUnique({
        where: { providerReference: input.providerReference },
        include: transactionInclude,
      });
      if (seen) return toResponse(seen.status === 'APPROVED' ? { decision: 'APPROVED' } : { decision: 'BLOCKED', reason: seen.declineReason ?? 'CARD_NOT_ACTIVE' }, seen);
    }

    const outcome = await this.prisma.$transaction(async (tx) => {
      const locked = input.userId
        ? await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "Card" WHERE id = ${input.cardId} AND "userId" = ${input.userId} FOR UPDATE`
        : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Card" WHERE id = ${input.cardId} FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundException('Carte introuvable');

      const card = await tx.card.findUniqueOrThrow({ where: { id: input.cardId }, include: { policy: true } });
      const policy = card.policy;
      if (!policy) throw new NotFoundException('Carte introuvable');

      const knownMerchant = await tx.merchant.findUnique({ where: { slug: merchantSlug } });
      const now = new Date();

      let decision: PolicyDecision;
      try {
        decision = this.engine.evaluate(
          { ...policy, status: card.status },
          { merchant: input.merchant, amount: input.amount, currency: input.currency },
          now,
        );
      } catch (error) {
        if (error instanceof InvalidTransactionAttemptError) throw new BadRequestException(error.message);
        throw error;
      }

      let terminatedProviderCardId: string | null = null;
      if (decision.decision === 'APPROVED') {
        const usage = this.engine.applyApprovedTransaction({ ...policy, status: card.status }, input.amount);
        await tx.cardPolicy.update({
          where: { id: policy.id },
          data: { spentAmount: usage.spentAmount, currentTransactionCount: usage.currentTransactionCount },
        });
        if (usage.usageExhausted) {
          await tx.card.update({
            where: { id: card.id },
            data: { status: 'TERMINATED', terminationReason: 'USAGE_LIMIT_REACHED' },
          });
          terminatedProviderCardId = card.providerCardId;
        }
      } else if (decision.reason === 'CARD_EXPIRED' && (card.status === 'ACTIVE' || card.status === 'FROZEN')) {
        await tx.card.update({ where: { id: card.id }, data: { status: 'EXPIRED' } });
      }

      const transaction = await tx.transaction.create({
        data: {
          cardId: card.id,
          merchant: merchantSlug,
          merchantName: knownMerchant?.name ?? input.merchant.trim(),
          amount: input.amount,
          currency: input.currency,
          status: decision.decision,
          declineReason: decision.decision === 'BLOCKED' ? decision.reason : null,
          providerReference: input.providerReference ?? null,
        },
        include: transactionInclude,
      });
      return { decision, transaction, terminatedProviderCardId };
    });

    if (outcome.terminatedProviderCardId) {
      await this.issuer.terminateCard(outcome.terminatedProviderCardId);
    }
    this.logger.log(
      `Transaction ${outcome.transaction.id} ${outcome.decision.decision}` +
        (outcome.decision.decision === 'BLOCKED' ? ` (${outcome.decision.reason})` : ''),
    );

    return toResponse(outcome.decision, outcome.transaction);
  }
}

export interface AuthorizationAttempt extends SimulateTransactionInput {
  /** The owner's id for a sandbox simulation (the card must be theirs); absent for an issuer request. */
  userId?: string;
  /** The issuer's event id for a real authorization. */
  providerReference?: string;
}

function toResponse(
  decision: PolicyDecision,
  transaction: Parameters<typeof toTransactionDto>[0],
): SimulateTransactionResponseDto {
  const dto = toTransactionDto(transaction);
  return decision.decision === 'APPROVED'
    ? { status: 'APPROVED', transaction: dto }
    : { status: 'BLOCKED', reason: decision.reason, transaction: dto };
}
