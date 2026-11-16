import { Module } from '@nestjs/common';
import { ExaminationsController } from './examinations.controller';
import { ExaminationsService } from './examinations.service';
import { MarksModule } from '@/modules/marks/marks.module';
import { ScopeModule } from '@/common/services/scope.module';

/**
 * The examinations module.
 *
 * The marks module is imported for the calculator factory — the readiness
 * check asks the scheme's own rules how complete a result is, rather than
 * counting marks and hoping.
 */
@Module({
  imports: [MarksModule, ScopeModule],
  controllers: [ExaminationsController],
  providers: [ExaminationsService],
  exports: [ExaminationsService],
})
export class ExaminationsModule {}
