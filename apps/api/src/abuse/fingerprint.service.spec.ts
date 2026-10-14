import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AppEnv } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import { FingerprintService, normalizeIdentity, normalizePhone } from './fingerprint.service';

interface Row {
  hash: string;
  kind: 'IDENTITY' | 'PHONE';
  userId: string | null;
  freeCardsUsed: number;
}
type Where = { hash?: string; kind?: string; userId?: string | null; OR?: Where[] };

const matches = (row: Row, where: Where): boolean =>
  (where.hash === undefined || row.hash === where.hash) &&
  (where.kind === undefined || row.kind === where.kind) &&
  (where.userId === undefined || row.userId === where.userId) &&
  (where.OR === undefined || where.OR.some((w) => matches(row, w)));

/** In-memory stand-in for the Prisma calls FingerprintService makes. */
function setup(env: Partial<AppEnv> = {}) {
  const rows: Row[] = [];
  let pendingFree = 0;
  const prisma = {
    fingerprint: {
      updateMany: async ({ where, data }: { where: Where; data: { userId?: string; freeCardsUsed?: { increment: number } } }) => {
        const hit = rows.filter((r) => matches(r, where));
        for (const r of hit) {
          if (data.userId !== undefined) r.userId = data.userId;
          if (data.freeCardsUsed) r.freeCardsUsed += data.freeCardsUsed.increment;
        }
        return { count: hit.length };
      },
      create: async ({ data }: { data: Omit<Row, 'freeCardsUsed'> }) => {
        if (rows.some((r) => r.hash === data.hash)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
        }
        rows.push({ ...data, freeCardsUsed: 0 });
      },
      upsert: async ({ where, create, update }: { where: { hash: string }; create: Omit<Row, 'freeCardsUsed'>; update: { userId: string } }) => {
        const row = rows.find((r) => r.hash === where.hash);
        if (row) row.userId = update.userId;
        else rows.push({ ...create, freeCardsUsed: 0 });
      },
      findMany: async ({ where }: { where: Where }) => rows.filter((r) => matches(r, where)),
    },
    funding: { count: async () => pendingFree },
  } as unknown as PrismaService;

  const service = new FingerprintService(prisma, {
    JWT_SECRET: 'x'.repeat(32),
    FINGERPRINT_SECRET: '',
    FREE_CARDS_PER_PERSON: 1,
    SERVICE_FEE_BPS: 500,
    ...env,
  } as AppEnv);
  /** What deleting an account does to its fingerprints (onDelete: SetNull). */
  const deleteAccount = (userId: string) => rows.filter((r) => r.userId === userId).forEach((r) => (r.userId = null));
  return { service, rows, deleteAccount, setPendingFree: (n: number) => (pendingFree = n) };
}

const ama = { firstName: 'Ama', lastName: 'Kodjo', dateOfBirth: new Date('1995-02-03T00:00:00.000Z'), country: 'TG' };
const phone = '+22890123456';

describe('normalisation', () => {
  it('ignores case, accents, spacing and the order of name parts', () => {
    expect(normalizeIdentity({ ...ama, firstName: '  KODJO ', lastName: 'amà' })).toBe(normalizeIdentity(ama));
    expect(normalizeIdentity({ ...ama, dateOfBirth: new Date('1995-02-04T00:00:00.000Z') })).not.toBe(normalizeIdentity(ama));
    expect(normalizePhone('+228 90 12 34 56')).toBe('22890123456');
  });
});

describe('FingerprintService', () => {
  it('stores only a keyed hash, never the identity or the number', async () => {
    const { service, rows } = setup();
    await service.claimIdentity('u1', ama);
    await service.recordPhone('u1', phone);
    const stored = JSON.stringify(rows);
    expect(stored).not.toMatch(/ama|kodjo|1995|90123456/i);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.hash))).toBe(true);
  });

  it('refuses an identity held by another live account, and frees it once that account is deleted', async () => {
    const { service, deleteAccount } = setup();
    await service.claimIdentity('u1', ama);
    await expect(service.claimIdentity('u1', ama)).resolves.toBeUndefined(); // same account: fine
    await expect(service.claimIdentity('u2', { ...ama, firstName: 'KODJO', lastName: 'Ama' })).rejects.toThrow(ConflictException);

    deleteAccount('u1');
    await expect(service.claimIdentity('u2', ama)).resolves.toBeUndefined();
  });

  it('keeps the free card used after the account is deleted and re-created', async () => {
    const { service, deleteAccount } = setup();
    await service.claimIdentity('u1', ama);
    expect(await service.freeCardAvailable('u1', phone)).toBe(true);
    await service.consumeFreeCard('u1', phone);
    expect(await service.freeCardAvailable('u1', phone)).toBe(false);

    deleteAccount('u1');
    await service.claimIdentity('u2', ama);
    expect(await service.freeCardAvailable('u2', '+22899999999')).toBe(false); // same person, new number

    await service.claimIdentity('u3', { ...ama, firstName: 'Afi' });
    expect(await service.freeCardAvailable('u3', phone)).toBe(false); // new identity, same number
    expect(await service.freeCardAvailable('u3', '+22891111111')).toBe(true);
  });

  it('counts a free funding still waiting for confirmation', async () => {
    const { service, setPendingFree } = setup();
    await service.claimIdentity('u1', ama);
    setPendingFree(1);
    expect(await service.freeCardAvailable('u1', phone)).toBe(false);
  });

  it('offers no free card when the allowance or the fee is zero', async () => {
    expect(await setup({ FREE_CARDS_PER_PERSON: 0 }).service.freeCardAvailable('u1', phone)).toBe(false);
    expect(await setup({ SERVICE_FEE_BPS: 0 }).service.freeCardAvailable('u1', phone)).toBe(false);
  });
});
