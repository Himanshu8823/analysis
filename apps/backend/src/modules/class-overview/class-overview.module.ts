import { Module } from '@nestjs/common';
import { ClassOverviewController } from './class-overview.controller';
import { ClassOverviewService } from './class-overview.service';
import { ClassOverviewRepository } from './class-overview.repository';

@Module({
  controllers: [ClassOverviewController],
  providers: [ClassOverviewService, ClassOverviewRepository],
  exports: [ClassOverviewService],
})
export class ClassOverviewModule {}
