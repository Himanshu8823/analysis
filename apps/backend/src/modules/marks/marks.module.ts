import { Module } from '@nestjs/common';
import { MarksController } from './marks.controller';
import { MarksService } from './marks.service';
import { MarksRepository } from './marks.repository';
import {
  CalculatorFactory,
  Scheme2019Calculator,
  Scheme2022Calculator,
  Scheme2024Calculator,
} from './calculator';

@Module({
  controllers: [MarksController],
  providers: [
    MarksService,
    MarksRepository,
    CalculatorFactory,
    Scheme2019Calculator,
    Scheme2022Calculator,
    Scheme2024Calculator,
  ],
  exports: [MarksService, CalculatorFactory],
})
export class MarksModule {}
