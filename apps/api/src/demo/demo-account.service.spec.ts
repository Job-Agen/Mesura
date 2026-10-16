import type { AppEnv } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import { DEMO_EMAIL, DEMO_PASSWORD } from './demo-account';
import { DemoAccountService } from './demo-account.service';

/** Records what the service asks of the database; `usable` = demo cards still active for a day. */
function setup({ sandbox = true, exists = true, usable = 0 } = {}) {
  const calls: string[] = [];
  const prisma = {
    user: {
      findUnique: async () => (exists ? { id: 'demo' } : null),
      create: async () => (calls.push('user.create'), { id: 'demo' }),
    },
    card: {
      count: async () => usable,
      deleteMany: async () => void calls.push('card.deleteMany'),
      create: async () => void calls.push('card.create'),
    },
    merchant: { upsert: async () => undefined },
    $transaction: async (fn: (tx: unknown) => Promise<void>) => fn(prisma),
  };
  const service = new DemoAccountService(prisma as unknown as PrismaService, { SANDBOX_MODE: sandbox } as AppEnv);
  return { service, calls };
}

describe('DemoAccountService', () => {
  it('does nothing outside the sandbox, for another account, or with a wrong password', async () => {
    for (const [opts, email, password] of [
      [{ sandbox: false }, DEMO_EMAIL, DEMO_PASSWORD],
      [{}, 'ama@test.dev', DEMO_PASSWORD],
      [{}, DEMO_EMAIL, 'wrong-password'],
    ] as const) {
      const { service, calls } = setup(opts);
      await service.prepareForSignIn(email, password);
      expect(calls).toEqual([]);
    }
  });

  it('recreates the demo account with its cards after it was deleted', async () => {
    const { service, calls } = setup({ exists: false });
    await service.prepareForSignIn(DEMO_EMAIL, DEMO_PASSWORD);
    expect(calls[0]).toBe('user.create');
    expect(calls.filter((c) => c === 'card.create')).toHaveLength(4);
  });

  it('rebuilds the cards when none stays active for a day, and leaves usable cards alone', async () => {
    const stale = setup({ usable: 0 });
    await stale.service.prepareForSignIn(DEMO_EMAIL, DEMO_PASSWORD);
    expect(stale.calls).toEqual(['card.deleteMany', 'card.create', 'card.create', 'card.create', 'card.create']);

    const fresh = setup({ usable: 1 });
    await fresh.service.prepareForSignIn(DEMO_EMAIL, DEMO_PASSWORD);
    expect(fresh.calls).toEqual([]);
  });
});
