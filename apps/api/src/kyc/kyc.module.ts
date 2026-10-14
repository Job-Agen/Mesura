import { Module } from '@nestjs/common';
import { AbuseModule } from '../abuse/abuse.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [AbuseModule],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
