import { Module } from '@nestjs/common';
import { ToppersController } from './toppers.controller';
import { ToppersService } from './toppers.service';
import { ToppersRepository } from './toppers.repository';
import { TopperStrategyFactory } from './algorithms';

@Module({
  controllers: [ToppersController],
  providers: [ToppersService, ToppersRepository, TopperStrategyFactory],
  exports: [ToppersService, TopperStrategyFactory],
})
export class ToppersModule {}
