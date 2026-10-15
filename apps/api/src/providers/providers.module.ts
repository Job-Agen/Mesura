import { Global, Module } from '@nestjs/common';
import { APP_ENV, type AppEnv } from '../config/env';
import { CARD_ISSUER_PROVIDER } from './card-issuer-provider.interface';
import { EMAIL_PROVIDER } from './email-provider.interface';
import { FedaPayPaymentProvider } from './fedapay/fedapay-payment.provider';
import { FedaPayPayoutProvider } from './fedapay/fedapay-payout.provider';
import { LogEmailProvider } from './email/log-email.provider';
import { ResendEmailProvider } from './email/resend-email.provider';
import { KYC_PROVIDER } from './kyc-provider.interface';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { PAYOUT_PROVIDER } from './payout-provider.interface';
import { SandboxCardIssuerProvider } from './sandbox/sandbox-card-issuer.provider';
import { SandboxKycProvider } from './sandbox/sandbox-kyc.provider';
import { SandboxMobileMoneyProvider } from './sandbox/sandbox-mobile-money.provider';
import { SandboxPayoutProvider } from './sandbox/sandbox-payout.provider';

/**
 * Binds provider interfaces to implementations. Swapping to a real partner
 * (issuer, Mobile Money aggregator, KYC vendor) happens here only — business
 * services depend on the injection tokens, never on the sandbox classes.
 */
@Global()
@Module({
  providers: [
    SandboxMobileMoneyProvider,
    SandboxCardIssuerProvider,
    SandboxKycProvider,
    SandboxPayoutProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [APP_ENV, SandboxMobileMoneyProvider],
      useFactory: (env: AppEnv, simulated: SandboxMobileMoneyProvider) =>
        env.FEDAPAY_SECRET_KEY ? new FedaPayPaymentProvider(env.FEDAPAY_SECRET_KEY) : simulated,
    },
    {
      provide: PAYOUT_PROVIDER,
      inject: [APP_ENV, SandboxPayoutProvider],
      useFactory: (env: AppEnv, simulated: SandboxPayoutProvider) =>
        env.FEDAPAY_SECRET_KEY && env.FEDAPAY_PAYOUTS_ENABLED ? new FedaPayPayoutProvider(env.FEDAPAY_SECRET_KEY) : simulated,
    },
    { provide: CARD_ISSUER_PROVIDER, useExisting: SandboxCardIssuerProvider },
    { provide: KYC_PROVIDER, useExisting: SandboxKycProvider },
    {
      provide: EMAIL_PROVIDER,
      inject: [APP_ENV],
      useFactory: (env: AppEnv) =>
        env.RESEND_API_KEY ? new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM) : new LogEmailProvider(),
    },
  ],
  exports: [PAYMENT_PROVIDER, PAYOUT_PROVIDER, CARD_ISSUER_PROVIDER, KYC_PROVIDER, EMAIL_PROVIDER, SandboxMobileMoneyProvider],
})
export class ProvidersModule {}
