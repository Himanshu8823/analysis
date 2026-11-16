import { Module } from '@nestjs/common';
import { MarksController } from './marks.controller';
import { MarksService } from './marks.service';
import { MarksRepository } from './marks.repository';
import { MarksAuthorisationService } from './marks.authorisation.service';
import { MarksScopeService } from './marks-scope.service';
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
    MarksAuthorisationService,
    MarksScopeService,
    CalculatorFactory,
    Scheme2019Calculator,
    Scheme2022Calculator,
    Scheme2024Calculator,
  ],
  exports: [MarksService, MarksAuthorisationService, MarksScopeService, CalculatorFactory],
})
export class MarksModule {}
