import { ServiceUnavailableException } from '@nestjs/common';
import { loadEnv } from '../../config/env';
import type { InitiateFundingRequest } from '../payment-provider.interface';
import { FedaPayPaymentProvider } from './fedapay-payment.provider';

interface Call {
  method: string;
  url: string;
  body: Record<string, unknown> | undefined;
}

/** Stands in for FedaPay: records each request and answers like the sandbox does. */
function mockFedaPay(status = 'pending', failWith?: number) {
  const calls: Call[] = [];
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (failWith) return new Response('{}', { status: failWith });
    if (url.endsWith('/token')) return Response.json({ token: 'tok_1', url: 'https://process.fedapay.com/tok_1' });
    if (url.includes('/transactions')) return Response.json({ 'v1/transaction': { id: 42, status } });
    return Response.json({ 'v1/payment_intent': { status: 'approved' } });
  });
  return calls;
}

const request: InitiateFundingRequest = {
  reference: 'ref-1',
  provider: 'TMONEY',
  phone: '+22890123456',
  amount: 15_750,
  currency: 'XOF',
  description: 'Mesura card funding',
  customer: { firstName: 'Ama', lastName: 'Kodjo', email: 'ama@test.dev' },
};

afterEach(() => jest.restoreAllMocks());

describe('FedaPayPaymentProvider', () => {
  it('creates the transaction, gets its token and pushes the request to the phone', async () => {
    const calls = mockFedaPay();
    const result = await new FedaPayPaymentProvider('sk_live_x').initiateFunding(request);

    expect(result).toEqual({ providerReference: '42', status: 'PENDING' });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST https://api.fedapay.com/v1/transactions',
      'POST https://api.fedapay.com/v1/transactions/42/token',
      'POST https://api.fedapay.com/v1/togocel',
    ]);
    expect(calls[0]?.body).toMatchObject({
      amount: 15_750,
      currency: { iso: 'XOF' },
      merchant_reference: 'ref-1',
      customer: { firstname: 'Ama', lastname: 'Kodjo', email: 'ama@test.dev' },
    });
    expect(calls[2]?.body).toEqual({ token: 'tok_1', phone_number: { number: '+22890123456', country: 'TG' } });
  });

  it('sends Flooz and Moov Money to moov_tg', async () => {
    const calls = mockFedaPay();
    await new FedaPayPaymentProvider('sk_live_x').initiateFunding({ ...request, provider: 'FLOOZ' });
    expect(calls[2]?.url).toBe('https://api.fedapay.com/v1/moov_tg');
  });

  it('uses the sandbox test number in sandbox, and the real number (declined) when it ends in 99', async () => {
    const calls = mockFedaPay();
    const provider = new FedaPayPaymentProvider('sk_sandbox_x');
    await provider.initiateFunding(request);
    await provider.initiateFunding({ ...request, phone: '+22890123499' });

    expect(calls[2]?.url).toBe('https://sandbox-api.fedapay.com/v1/momo_test');
    expect(calls[2]?.body?.phone_number).toEqual({ number: '64000001', country: 'BJ' });
    expect(calls[5]?.body?.phone_number).toEqual({ number: '+22890123499', country: 'TG' });
  });

  it.each([
    ['pending', 'PENDING'],
    ['approved', 'CONFIRMED'],
    ['transferred', 'CONFIRMED'],
    ['declined', 'FAILED'],
    ['canceled', 'FAILED'],
    ['expired', 'EXPIRED'],
  ])('maps FedaPay status %s to %s', async (fedapay, mesura) => {
    mockFedaPay(fedapay);
    await expect(new FedaPayPaymentProvider('sk_sandbox_x').getFundingStatus('42')).resolves.toEqual({ status: mesura });
  });

  it('answers 503 in French when FedaPay fails', async () => {
    mockFedaPay('pending', 500);
    await expect(new FedaPayPaymentProvider('sk_sandbox_x').initiateFunding(request)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});

describe('FedaPay configuration', () => {
  const base = { DATABASE_URL: 'postgres://x', JWT_SECRET: 'x'.repeat(32) };

  it('refuses a live key unless explicitly allowed, and without real refunds', () => {
    expect(() => loadEnv({ ...base, FEDAPAY_SECRET_KEY: 'sk_live_x' })).toThrow(/FEDAPAY_ALLOW_LIVE/);
    expect(() => loadEnv({ ...base, FEDAPAY_SECRET_KEY: 'sk_live_x', FEDAPAY_ALLOW_LIVE: 'true' })).toThrow(/FEDAPAY_PAYOUTS_ENABLED/);
    expect(() =>
      loadEnv({ ...base, FEDAPAY_SECRET_KEY: 'sk_live_x', FEDAPAY_ALLOW_LIVE: 'true', FEDAPAY_PAYOUTS_ENABLED: 'true', SANDBOX_MODE: 'true' }),
    ).toThrow(/SANDBOX_MODE/);
    expect(
      loadEnv({ ...base, FEDAPAY_SECRET_KEY: 'sk_live_x', FEDAPAY_ALLOW_LIVE: 'true', FEDAPAY_PAYOUTS_ENABLED: 'true' }).FEDAPAY_SECRET_KEY,
    ).toBe('sk_live_x');
    expect(loadEnv({ ...base, FEDAPAY_SECRET_KEY: 'sk_sandbox_x' }).FEDAPAY_SECRET_KEY).toBe('sk_sandbox_x');
  });
});
