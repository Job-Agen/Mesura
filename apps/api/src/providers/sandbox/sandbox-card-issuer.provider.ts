import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import type {
  CardIssuerProvider,
  CardSecrets,
  CreateCardRequest,
  IssuedCard,
  IssuerCardStatus,
} from '../card-issuer-provider.interface';

/**
 * Fake virtual card issuer: a random provider id and last4 at issue time. The demo details it
 * reveals are derived from the provider id on demand (never stored) and use the Visa test range
 * 4000 00, so no merchant accepts them.
 */
@Injectable()
export class SandboxCardIssuerProvider implements CardIssuerProvider {
  private readonly logger = new Logger(SandboxCardIssuerProvider.name);
  private readonly cards = new Map<string, IssuedCard>();

  async createCard(request: CreateCardRequest): Promise<IssuedCard> {
    const card: IssuedCard = {
      providerCardId: `sbx_card_${randomUUID()}`,
      last4: randomInt(0, 10_000).toString().padStart(4, '0'),
      status: 'ACTIVE',
    };
    this.cards.set(card.providerCardId, card);
    this.logger.log(`Sandbox card issued ${card.providerCardId} for card ${request.cardId}`);
    return { ...card };
  }

  async freezeCard(providerCardId: string): Promise<void> {
    this.setStatus(providerCardId, 'FROZEN');
  }

  async unfreezeCard(providerCardId: string): Promise<void> {
    this.setStatus(providerCardId, 'ACTIVE');
  }

  async terminateCard(providerCardId: string): Promise<void> {
    this.setStatus(providerCardId, 'TERMINATED');
  }

  async getCard(providerCardId: string): Promise<IssuedCard | null> {
    const card = this.cards.get(providerCardId);
    return card ? { ...card } : null;
  }

  async revealCard(providerCardId: string, last4: string, expiresAt: Date): Promise<CardSecrets> {
    const digits = [...createHash('sha256').update(providerCardId).digest()].map((b) => b % 10);
    // 4000 00 + 5 derived digits + 1 check-fixing digit + the last4 shown in the app.
    const head = `400000${digits.slice(0, 5).join('')}`;
    const pan = `${head}${luhnFixDigit(head, last4)}${last4}`;
    return {
      pan,
      expiryMonth: expiresAt.getUTCMonth() + 1,
      expiryYear: expiresAt.getUTCFullYear(),
      cvv: digits.slice(5, 8).join(''),
      demo: true,
    };
  }

  private setStatus(providerCardId: string, status: IssuerCardStatus): void {
    const card = this.cards.get(providerCardId);
    // Cards issued before an API restart are unknown in memory; the DB stays authoritative.
    if (card) card.status = status;
  }
}

/** The digit that, placed between `head` and `tail`, makes the whole number pass the Luhn check. */
export function luhnFixDigit(head: string, tail: string): number {
  for (let d = 0; d <= 9; d++) if (luhnValid(`${head}${d}${tail}`)) return d;
  throw new Error('unreachable: one digit always fixes the Luhn sum');
}

export function luhnValid(number: string): boolean {
  let sum = 0;
  [...number].reverse().forEach((char, i) => {
    let n = Number(char);
    if (i % 2 === 1) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  });
  return sum % 10 === 0;
}
