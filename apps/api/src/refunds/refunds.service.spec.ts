import { SandboxPayoutProvider } from '../providers/sandbox/sandbox-payout.provider';
import { refundableBalance } from './refunds.service';

describe('refundableBalance', () => {
  it('refunds what was funded and not spent, never less than zero', () => {
    expect(refundableBalance(15_000, 0)).toBe(15_000);
    expect(refundableBalance(15_000, 10_750)).toBe(4_250);
    expect(refundableBalance(15_000, 15_000)).toBe(0);
    expect(refundableBalance(10_000, 12_000)).toBe(0);
  });
});

describe('SandboxPayoutProvider', () => {
  const request = {
    provider: 'TMONEY' as const,
    amount: 1_000,
    currency: 'XOF' as const,
    customer: { firstName: 'Ama', lastName: 'Kodjo', email: 'ama@test.dev' },
  };

  it('sends at once, and fails for a number ending in 99; any instance can read the outcome back', async () => {
    const payouts = new SandboxPayoutProvider();
    const sent = await payouts.sendPayout({ ...request, phone: '+22890123456' });
    const failed = await payouts.sendPayout({ ...request, phone: '+22890123499' });

    expect(sent.status).toBe('SENT');
    expect(failed.status).toBe('FAILED');
    await expect(new SandboxPayoutProvider().getPayoutStatus(sent.providerReference)).resolves.toBe('SENT');
    await expect(new SandboxPayoutProvider().getPayoutStatus(failed.providerReference)).resolves.toBe('FAILED');
  });
});
