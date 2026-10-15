import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [CardsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
