import { createCipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { FyatuCardIssuerProvider, usdToXof, xofToUsd } from './fyatu-card-issuer.provider';
import { FyatuApiError, type FyatuClient } from './fyatu-client';
import { decryptFyatuSecret, verifyFyatuSignature } from './fyatu-crypto';

const SECRET = 'whsec_test_secret';
const API_KEY = 'fyatu_test_key';

/** Signs like Fyatu does (documented algorithm), to test our verification against it. */
function sign(body: string, timestamp: number, secret = SECRET): string {
  const key = createHash('sha256').update(secret, 'utf8').digest('hex');
  return `t=${timestamp},v1=${createHmac('sha256', key).update(`${timestamp}.${body}`).digest('hex')}`;
}

/** Encrypts like Fyatu's secure-details endpoint (documented algorithm). */
function encrypt(plain: string, apiKey = API_KEY): string {
  const key = createHash('sha256').update(`fyatu/card-secrets/v1:${apiKey}`, 'utf8').digest();
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, body, cipher.getAuthTag()]).toString('base64');
}

describe('Fyatu webhook signature', () => {
  const body = '{"event":"CARD_AUTHORIZATION_VERIFY"}';
  const now = 1_793_000_000_000;
  const ts = now / 1000;

  it('accepts a signature made with the webhook secret over the raw body', () => {
    expect(verifyFyatuSignature(Buffer.from(body), sign(body, ts), SECRET, now)).toBe(true);
  });

  it('refuses a tampered body, a wrong secret, a stale timestamp or a missing header', () => {
    expect(verifyFyatuSignature(Buffer.from(body.replace('VERIFY', 'X')), sign(body, ts), SECRET, now)).toBe(false);
    expect(verifyFyatuSignature(Buffer.from(body), sign(body, ts, 'whsec_other'), SECRET, now)).toBe(false);
    expect(verifyFyatuSignature(Buffer.from(body), sign(body, ts - 301), SECRET, now)).toBe(false);
    expect(verifyFyatuSignature(Buffer.from(body), undefined, SECRET, now)).toBe(false);
    expect(verifyFyatuSignature(Buffer.from(body), 't=abc,v1=zz', SECRET, now)).toBe(false);
  });
});

describe('Fyatu card secrets', () => {
  it('decrypts AES-256-GCM values keyed with the API key, and refuses an altered one', () => {
    expect(decryptFyatuSecret(encrypt('4111111111111111'), API_KEY)).toBe('4111111111111111');
    const altered = Buffer.from(encrypt('123'), 'base64');
    altered.writeUInt8(altered.readUInt8(13) ^ 1, 13);
    expect(() => decryptFyatuSecret(altered.toString('base64'), API_KEY)).toThrow();
    expect(() => decryptFyatuSecret(encrypt('123'), 'other_key')).toThrow();
  });
});

describe('FCFA ↔ USD conversion', () => {
  it('never loads a card above its limit and never under-counts a payment', () => {
    expect(xofToUsd(15_000, 600)).toBe(25);
    expect(xofToUsd(10_001, 600)).toBe(16.66);
    expect(usdToXof(16.67, 600)).toBe(10_002);
    expect(usdToXof(0.1, 600)).toBe(60);
  });
});

describe('FyatuCardIssuerProvider', () => {
  function setup({ jit = true, kycApproved = true, issuedLast4 = '4123' as string | null } = {}) {
    const calls: { method: string; path: string; body?: unknown }[] = [];
    const user = {
      id: 'u1',
      email: 'ama@test.dev',
      phone: '+22890123456',
      issuerCardholderId: null as string | null,
      kycProfile: { firstName: 'Ama', lastName: 'Kodjo', dateOfBirth: new Date('1990-05-15T00:00:00Z'), country: 'TG' },
    };
    let gets = 0;
    const client = {
      apiKey: API_KEY,
      testMode: true,
      call: async (method: string, path: string, body?: unknown) => {
        calls.push({ method, path, body });
        if (path === '/cardholders') return { cardholderId: 'chl_1', kycStatus: 'APPROVED' };
        if (path === '/cards' && method === 'POST') {
          if (!kycApproved) throw new FyatuApiError(422, 'CARDHOLDER_KYC_NOT_APPROVED');
          return { id: 'crd_1', status: issuedLast4 ? 'ACTIVE' : 'CREATING', last4: issuedLast4 };
        }
        if (path === '/cards/crd_1' && method === 'GET') {
          gets += 1;
          return { id: 'crd_1', status: 'ACTIVE', last4: gets >= 2 ? '9876' : null };
        }
        if (path === '/cards/crd_1/secure-details') {
          return { cardNumber: encrypt('4111 1111 1111 1111'), cvv: encrypt('321'), expirationDate: encrypt('06/2030') };
        }
        return {};
      },
    } as unknown as FyatuClient;
    const prisma = {
      user: {
        findUniqueOrThrow: async () => user,
        update: async ({ data }: { data: { issuerCardholderId: string } }) => Object.assign(user, data),
      },
    } as unknown as PrismaService;
    const provider = new FyatuCardIssuerProvider(client, prisma, { productId: 'prd_1', jit, xofPerUsd: 600 }, async () => undefined);
    const request = { cardId: 'c1', userId: 'u1', label: 'Carte Netflix', expiresAt: new Date(), limitXof: 15_000 };
    return { provider, calls, user, request };
  }

  it('creates the cardholder once from the verified identity, then issues a just-in-time card without balance', async () => {
    const { provider, calls, user, request } = setup();
    await expect(provider.createCard(request)).resolves.toEqual({ providerCardId: 'crd_1', last4: '4123', status: 'ACTIVE' });
    expect(calls[0]).toMatchObject({
      path: '/cardholders',
      body: { firstName: 'Ama', lastName: 'Kodjo', email: 'ama@test.dev', dateOfBirth: '1990-05-15', nationality: 'TG', externalId: 'u1' },
    });
    expect(calls[1]).toMatchObject({ path: '/cards', body: { cardholderId: 'chl_1', productId: 'prd_1' } });
    expect((calls[1]?.body as Record<string, unknown>).amount).toBeUndefined();
    expect(user.issuerCardholderId).toBe('chl_1');

    await provider.createCard(request);
    expect(calls.filter((c) => c.path === '/cardholders')).toHaveLength(1);
  });

  it('loads a non-JIT card with its limit converted to dollars', async () => {
    const { provider, calls, request } = setup({ jit: false });
    await provider.createCard(request);
    expect(calls[1]?.body).toMatchObject({ amount: 25 });
  });

  it('waits for an asynchronously issued card number', async () => {
    const { provider, request } = setup({ issuedLast4: null });
    await expect(provider.createCard(request)).resolves.toMatchObject({ last4: '9876' });
  });

  it('explains a cardholder still under the issuer review', async () => {
    const { provider, request } = setup({ kycApproved: false });
    await expect(provider.createCard(request)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('decrypts the real card details for display, flagged as test cards in test mode', async () => {
    const { provider } = setup();
    await expect(provider.revealCard('crd_1')).resolves.toEqual({
      pan: '4111111111111111',
      expiryMonth: 6,
      expiryYear: 2030,
      cvv: '321',
      demo: true,
    });
  });
});
