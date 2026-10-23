import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CardPoliciesModule } from './card-policies/card-policies.module';
import { CardsModule } from './cards/cards.module';
import { ConfigModule } from './config/config.module';
import { FundingModule } from './funding/funding.module';
import { HealthController } from './health/health.controller';
import { AdminController } from './community/admin.controller';
import { CommunityController } from './community/community.controller';
import { LegalController } from './legal/legal.controller';
import { KycModule } from './kyc/kyc.module';
import { MerchantsModule } from './merchants/merchants.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProvidersModule } from './providers/providers.module';
import { SandboxModule } from './sandbox/sandbox.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    // Default: 120 requests per minute per client; stricter limits on auth,
    // KYC, funding and sandbox payment routes.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      errorMessage: 'Trop de tentatives. Patientez une minute puis réessayez.',
    }),
    ProvidersModule,
    CardPoliciesModule,
    AuthModule,
    UsersModule,
    KycModule,
    MerchantsModule,
    CardsModule,
    FundingModule,
    TransactionsModule,
    SandboxModule,
  ],
  controllers: [HealthController, LegalController, CommunityController, AdminController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
