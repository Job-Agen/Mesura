import { createHash, createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import type { AppEnv } from '../config/env';
import type { PrismaService } from '../prisma/prisma.service';
import { FyatuWebhookController } from './fyatu-webhook.controller';
import type { TransactionsService } from './transactions.service';

const SECRET = 'whsec_test';

function signedRequest(payload: unknown) {
  const raw = JSON.stringify(payload);
  const t = Math.floor(Date.now() / 1000);
  const key = createHash('sha256').update(SECRET).digest('hex');
  const signature = `t=${t},v1=${createHmac('sha256', key).update(`${t}.${raw}`).digest('hex')}`;
  return { req: { rawBody: Buffer.from(raw), body: payload } as never, signature };
}

function setup(card: { id: string; status: string } | null, authorize?: TransactionsService['authorizeCard']) {
  const seen: unknown[] = [];
  const env = { FYATU_API_KEY: 'key', FYATU_WEBHOOK_SECRET: SECRET, FYATU_XOF_PER_USD: 600 } as AppEnv;
  const prisma = {
    card: { findUnique: async () => card, updateMany: async (args: unknown) => void seen.push(args) },
  } as unknown as PrismaService;
  const transactions = {
    authorizeCard: authorize ?? (async (input: unknown) => (seen.push(input), { status: 'APPROVED', transaction: {} })),
  } as unknown as TransactionsService;
  return { controller: new FyatuWebhookController(env, prisma, transactions), seen };
}

const authorization = (data: Record<string, unknown>) => ({
  event: 'CARD_AUTHORIZATION_VERIFY',
  eventId: 'evt_1',
  data: { type: 'AUTHORIZATION', cardId: 'crd_1', amount: 16.5, feeAmount: 0.17, currency: 'USD', merchantName: 'NETFLIX.COM', ...data },
});

describe('FyatuWebhookController', () => {
  it('runs Mesura rules on a payment, in FCFA, with the event id, and approves', async () => {
    const { controller, seen } = setup({ id: 'c1', status: 'ACTIVE' });
    const { req, signature } = signedRequest(authorization({}));
    await expect(controller.receive(req, signature)).resolves.toEqual({ decision: 'APPROVE' });
    expect(seen[0]).toEqual({ cardId: 'c1', merchant: 'NETFLIX.COM', amount: 10_002, currency: 'XOF', providerReference: 'evt_1' });
  });

  it('maps a blocked payment to the matching Fyatu decline code', async () => {
    const { controller } = setup({ id: 'c1', status: 'ACTIVE' }, async () => ({ status: 'BLOCKED', reason: 'MERCHANT_NOT_ALLOWED', transaction: {} }) as never);
    const { req, signature } = signedRequest(authorization({ merchantName: 'SPOTIFY' }));
    await expect(controller.receive(req, signature)).resolves.toEqual({ decision: 'DECLINE', reason: 'INVALID_MERCHANT' });
  });

  it('declines (never errors) on an unknown card, an internal error or a bad signature', async () => {
    const unknown = setup(null);
    const a = signedRequest(authorization({}));
    await expect(unknown.controller.receive(a.req, a.signature)).resolves.toEqual({ decision: 'DECLINE', reason: 'RESTRICTED' });

    const failing = setup({ id: 'c1', status: 'ACTIVE' }, async () => {
      throw new Error('database down');
    });
    const b = signedRequest(authorization({}));
    await expect(failing.controller.receive(b.req, b.signature)).resolves.toEqual({ decision: 'DECLINE', reason: 'DO_NOT_HONOUR' });

    const forged = setup({ id: 'c1', status: 'ACTIVE' });
    const c = signedRequest(authorization({}));
    await expect(forged.controller.receive(c.req, 't=1,v1=00')).resolves.toEqual({ decision: 'DECLINE', reason: 'DO_NOT_HONOUR' });
    expect(forged.seen).toHaveLength(0);
  });

  it('allows adding an active card to a wallet, not a frozen one', async () => {
    const active = setup({ id: 'c1', status: 'ACTIVE' });
    const a = signedRequest(authorization({ type: 'AUTHORIZATION_VERIFY', amount: 0 }));
    await expect(active.controller.receive(a.req, a.signature)).resolves.toEqual({ decision: 'APPROVE' });
    const frozen = setup({ id: 'c1', status: 'FROZEN' });
    const b = signedRequest(authorization({ type: 'AUTHORIZATION_VERIFY', amount: 0 }));
    await expect(frozen.controller.receive(b.req, b.signature)).resolves.toEqual({ decision: 'DECLINE', reason: 'RESTRICTED' });
  });

  it('refuses other events with a bad signature, and stores the number of a card issued later', async () => {
    const { controller, seen } = setup(null);
    await expect(controller.receive(signedRequest({ event: 'CARD_ISSUED' }).req, 't=1,v1=00')).rejects.toBeInstanceOf(UnauthorizedException);
    const { req, signature } = signedRequest({ event: 'CARD_ISSUED', data: { cardId: 'crd_9', last4: '4242' } });
    await expect(controller.receive(req, signature)).resolves.toEqual({ received: true });
    expect(seen[0]).toEqual({ where: { providerCardId: 'crd_9', last4: null }, data: { last4: '4242' } });
  });
});
