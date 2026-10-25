import { Module } from '@nestjs/common';
import { SubjectsController } from './subjects.controller';
import { SubjectOfferingsController } from './subject-offerings.controller';
import { SubjectsService } from './subjects.service';
import { SubjectsRepository } from './subjects.repository';

@Module({
  controllers: [SubjectsController, SubjectOfferingsController],
  providers: [SubjectsService, SubjectsRepository],
  exports: [SubjectsService],
})
export class SubjectsModule {}
