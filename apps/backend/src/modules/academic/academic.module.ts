import { Module } from '@nestjs/common';
import { AcademicController } from './academic.controller';
import { AcademicStructureController } from './academic-structure.controller';
import { AcademicService } from './academic.service';
import { ScopeModule } from '@/common/services/scope.module';

@Module({
  imports: [ScopeModule],
  controllers: [AcademicController, AcademicStructureController],
  providers: [AcademicService],
  exports: [AcademicService],
})
export class AcademicModule {}
