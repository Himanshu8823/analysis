import { Module } from '@nestjs/common';
import {
  TeacherAllocationsController,
  ClassTeacherAssignmentsController,
} from './allocations.controller';
import { AllocationsService } from './allocations.service';
import { AllocationsRepository } from './allocations.repository';

@Module({
  controllers: [TeacherAllocationsController, ClassTeacherAssignmentsController],
  providers: [AllocationsService, AllocationsRepository],
  exports: [AllocationsService],
})
export class AllocationsModule {}
