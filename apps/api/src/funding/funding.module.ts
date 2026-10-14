import { Module } from '@nestjs/common';
import { AbuseModule } from '../abuse/abuse.module';
import { CardsModule } from '../cards/cards.module';
import { KycModule } from '../kyc/kyc.module';
import { FundingController } from './funding.controller';
import { FundingService } from './funding.service';

@Module({
  imports: [AbuseModule, CardsModule, KycModule],
  controllers: [FundingController],
  providers: [FundingService],
  exports: [FundingService],
})
export class FundingModule {}
