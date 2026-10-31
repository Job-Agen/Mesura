import { Module } from '@nestjs/common';
import { FyatuWebhookController } from './fyatu-webhook.controller';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController, FyatuWebhookController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
