import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsRepository } from './reports.repository';
import { ExcelReportGenerator } from './generators/excel.generator';
import { ReportsProcessor } from './reports.processor';
import { REPORT_QUEUE_NAME } from './reports.service';
import { MarksModule } from '../marks/marks.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: REPORT_QUEUE_NAME }),
    MarksModule,
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportsRepository,
    ExcelReportGenerator,
    ReportsProcessor,
  ],
  exports: [ReportsService, ExcelReportGenerator],
})
export class ReportsModule {}
