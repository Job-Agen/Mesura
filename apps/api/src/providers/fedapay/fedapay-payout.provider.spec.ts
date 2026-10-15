import { FedaPayPayoutProvider } from './fedapay-payout.provider';

interface Call {
  method: string;
  url: string;
  body: Record<string, unknown> | undefined;
}

/** Stands in for FedaPay payouts, answering like the responses in FedaPay's own SDK tests. */
function mockFedaPay(status = 'started') {
  const calls: Call[] = [];
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.endsWith('/payouts/start')) return Response.json({ 'v1/payouts': [{ id: 17, status }] });
    return Response.json({ 'v1/payout': { id: 17, status } });
  });
  return calls;
}

const request = {
  provider: 'TMONEY' as const,
  phone: '+22890123456',
  amount: 4_250,
  currency: 'XOF' as const,
  customer: { firstName: 'Ama', lastName: 'Kodjo', email: 'ama@test.dev' },
};

afterEach(() => jest.restoreAllMocks());

describe('FedaPayPayoutProvider', () => {
  it('creates a T-Money payout and starts it now', async () => {
    const calls = mockFedaPay();
    const result = await new FedaPayPayoutProvider('sk_sandbox_x').sendPayout(request);

    expect(result).toEqual({ providerReference: '17', status: 'PENDING' });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST https://sandbox-api.fedapay.com/v1/payouts',
      'PUT https://sandbox-api.fedapay.com/v1/payouts/start',
    ]);
    expect(calls[0]?.body).toMatchObject({
      amount: 4_250,
      currency: { iso: 'XOF' },
      mode: 'togocel',
      customer: { firstname: 'Ama', lastname: 'Kodjo', phone_number: { number: '+22890123456', country: 'TG' } },
    });
    expect(calls[1]?.body).toEqual({ payouts: [{ id: 17 }] });
  });

  it('refuses a wallet FedaPay cannot pay out to', async () => {
    mockFedaPay();
    await expect(new FedaPayPayoutProvider('sk_sandbox_x').sendPayout({ ...request, provider: 'FLOOZ' })).rejects.toThrow(/FLOOZ/);
  });

  it.each([
    ['pending', 'PENDING'],
    ['processing', 'PENDING'],
    ['sent', 'SENT'],
    ['failed', 'FAILED'],
  ])('maps FedaPay payout status %s to %s', async (fedapay, mesura) => {
    mockFedaPay(fedapay);
    await expect(new FedaPayPayoutProvider('sk_sandbox_x').getPayoutStatus('17')).resolves.toBe(mesura);
  });
});
