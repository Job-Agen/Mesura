import { Global, Module } from '@nestjs/common';
import { APP_ENV, type AppEnv } from '../config/env';
import { CARD_ISSUER_PROVIDER } from './card-issuer-provider.interface';
import { EMAIL_PROVIDER } from './email-provider.interface';
import { FedaPayPaymentProvider } from './fedapay/fedapay-payment.provider';
import { FedaPayPayoutProvider } from './fedapay/fedapay-payout.provider';
import { FyatuCardIssuerProvider } from './fyatu/fyatu-card-issuer.provider';
import { FyatuClient } from './fyatu/fyatu-client';
import { PrismaService } from '../prisma/prisma.service';
import { LogEmailProvider } from './email/log-email.provider';
import { ResendEmailProvider } from './email/resend-email.provider';
import { SmtpEmailProvider } from './email/smtp-email.provider';
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
    {
      provide: CARD_ISSUER_PROVIDER,
      inject: [APP_ENV, PrismaService, SandboxCardIssuerProvider],
      useFactory: (env: AppEnv, prisma: PrismaService, simulated: SandboxCardIssuerProvider) =>
        env.FYATU_API_KEY
          ? new FyatuCardIssuerProvider(
              new FyatuClient({ apiKey: env.FYATU_API_KEY, baseUrl: env.FYATU_API_URL, testMode: env.FYATU_TEST_MODE }),
              prisma,
              { productId: env.FYATU_PRODUCT_ID, jit: env.FYATU_JIT, xofPerUsd: env.FYATU_XOF_PER_USD },
            )
          : simulated,
    },
    { provide: KYC_PROVIDER, useExisting: SandboxKycProvider },
    {
      provide: EMAIL_PROVIDER,
      inject: [APP_ENV],
      useFactory: (env: AppEnv) => {
        if (env.RESEND_API_KEY) return new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM || 'Mesura <onboarding@resend.dev>');
        if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
          return new SmtpEmailProvider(
            { host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER, pass: env.SMTP_PASS },
            env.EMAIL_FROM || `Mesura <${env.SMTP_USER}>`,
          );
        }
        return new LogEmailProvider();
      },
    },
  ],
  exports: [PAYMENT_PROVIDER, PAYOUT_PROVIDER, CARD_ISSUER_PROVIDER, KYC_PROVIDER, EMAIL_PROVIDER, SandboxMobileMoneyProvider],
})
export class ProvidersModule {}
