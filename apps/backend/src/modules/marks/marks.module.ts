import { Module } from '@nestjs/common';
import { MarksController } from './marks.controller';
import { MarksService } from './marks.service';
import { MarksRepository } from './marks.repository';
import { MarksCalculatorService } from './calculator.service';
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
    MarksCalculatorService,
    CalculatorFactory,
    Scheme2019Calculator,
    Scheme2022Calculator,
    Scheme2024Calculator,
  ],
  exports: [MarksService, MarksCalculatorService, CalculatorFactory],
})
export class MarksModule {}
