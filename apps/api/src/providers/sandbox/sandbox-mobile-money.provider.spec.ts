import type { AppEnv } from '../../config/env';
import { SandboxMobileMoneyProvider } from './sandbox-mobile-money.provider';

const request = {
  reference: 'ref',
  provider: 'TMONEY' as const,
  phone: '+22890123456',
  amount: 15_750,
  currency: 'XOF' as const,
  description: 'test',
  customer: { firstName: 'Ama', lastName: 'Kodjo', email: 'ama@test.dev' },
};

function provider(autoConfirmSeconds: number) {
  return new SandboxMobileMoneyProvider({ SANDBOX_FUNDING_AUTO_CONFIRM_SECONDS: autoConfirmSeconds } as AppEnv);
}

describe('SandboxMobileMoneyProvider', () => {
  afterEach(() => jest.useRealTimers());

  it('stays pending, then auto-confirms after the configured delay', async () => {
    jest.useFakeTimers({ now: new Date('2026-01-12T10:00:00Z') });
    const p = provider(10);
    const { providerReference } = await p.initiateFunding(request);

    expect(await p.getFundingStatus(providerReference)).toEqual({ status: 'PENDING' });
    jest.setSystemTime(new Date('2026-01-12T10:00:10Z'));
    expect(await p.getFundingStatus(providerReference)).toEqual({ status: 'CONFIRMED' });
  });

  it('auto-confirms a request created by another instance (serverless)', async () => {
    jest.useFakeTimers({ now: new Date('2026-01-12T10:00:00Z') });
    const { providerReference } = await provider(10).initiateFunding(request);

    jest.setSystemTime(new Date('2026-01-12T10:00:11Z'));
    expect(await provider(10).getFundingStatus(providerReference)).toEqual({ status: 'CONFIRMED' });
  });

  it('never auto-confirms when the delay is 0, but accepts a manual confirmation', async () => {
    const p = provider(0);
    const { providerReference } = await p.initiateFunding(request);
    expect(await p.getFundingStatus(providerReference)).toEqual({ status: 'PENDING' });

    const other = provider(0);
    other.simulateCustomerConfirmation(providerReference);
    expect(await other.getFundingStatus(providerReference)).toEqual({ status: 'CONFIRMED' });
  });
});
