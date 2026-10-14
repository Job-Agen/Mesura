import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Prisma, type FingerprintKind } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { APP_ENV, type AppEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

export interface IdentityFacts {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  country: string;
}

/**
 * Same person, same string: accents, case, punctuation and the order of name parts are ignored,
 * so "Ama Kodjo" and "KODJO ama" match.
 */
export function normalizeIdentity(facts: IdentityFacts): string {
  const names = `${facts.firstName} ${facts.lastName}`
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join(' ');
  return `${names}|${facts.dateOfBirth.toISOString().slice(0, 10)}|${facts.country.trim().toUpperCase()}`;
}

/** Phones are validated as +228XXXXXXXX upstream; keep the digits only. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export const IDENTITY_IN_USE_MESSAGE =
  "Cette identité est déjà utilisée par un autre compte Mesura. Connectez-vous à ce compte, ou supprimez-le d'abord.";

/**
 * Per-person limits that survive account deletion. Only keyed hashes are stored: they let us
 * recognise a returning person, not recover who they are.
 */
@Injectable()
export class FingerprintService {
  private readonly key: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {
    this.key = env.FINGERPRINT_SECRET || createHmac('sha256', env.JWT_SECRET).update('mesura-fingerprint').digest('hex');
  }

  hash(kind: FingerprintKind, normalized: string): string {
    return createHmac('sha256', this.key).update(`${kind}:${normalized}`).digest('hex');
  }

  /**
   * Ties a verified identity to this account. One identity, one live account: an identity held by
   * another account is refused (409); after that account is deleted it can be claimed again, but
   * the free cards it already used stay used.
   */
  async claimIdentity(userId: string, facts: IdentityFacts): Promise<void> {
    const hash = this.hash('IDENTITY', normalizeIdentity(facts));
    const taken = await this.prisma.fingerprint.updateMany({
      where: { hash, OR: [{ userId: null }, { userId }] },
      data: { userId },
    });
    if (taken.count === 1) return;
    try {
      await this.prisma.fingerprint.create({ data: { hash, kind: 'IDENTITY', userId } });
    } catch (error) {
      // The row exists and belongs to another live account (or was claimed a moment ago).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(IDENTITY_IN_USE_MESSAGE);
      }
      throw error;
    }
  }

  /** Records the Mobile Money number used by this account (numbers can be shared, so never refused). */
  async recordPhone(userId: string, phone: string): Promise<void> {
    const hash = this.hash('PHONE', normalizePhone(phone));
    await this.prisma.fingerprint.upsert({
      where: { hash },
      create: { hash, kind: 'PHONE', userId },
      update: { userId },
    });
  }

  /**
   * Whether this person may fund one more card without the fee. A person is both their verified
   * identity and the Mobile Money number paying: the highest count of either applies, so neither a
   * new account nor a new number resets it. Pending free fundings count as used.
   */
  async freeCardAvailable(userId: string, phone: string): Promise<boolean> {
    const allowance = this.env.FREE_CARDS_PER_PERSON;
    if (allowance === 0 || this.env.SERVICE_FEE_BPS === 0) return false;

    const rows = await this.prisma.fingerprint.findMany({
      where: { OR: [{ userId, kind: 'IDENTITY' }, { hash: this.hash('PHONE', normalizePhone(phone)) }] },
      select: { freeCardsUsed: true },
    });
    const used = Math.max(0, ...rows.map((r) => r.freeCardsUsed));
    const pending = await this.prisma.funding.count({ where: { userId, status: 'PENDING', freeCard: true } });
    return used + pending < allowance;
  }

  /** Counts a confirmed free card against the person's identity and Mobile Money number. */
  async consumeFreeCard(userId: string, phone: string): Promise<void> {
    await this.recordPhone(userId, phone);
    await this.prisma.fingerprint.updateMany({
      where: { OR: [{ userId, kind: 'IDENTITY' }, { hash: this.hash('PHONE', normalizePhone(phone)) }] },
      data: { freeCardsUsed: { increment: 1 } },
    });
  }
}
