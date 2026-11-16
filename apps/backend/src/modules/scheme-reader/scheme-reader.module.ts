import { Module } from '@nestjs/common';
import { AiModule } from '@/common/ai/ai.module';
import { StorageModule } from '../storage/storage.module';
import { SchemeReaderController } from './scheme-reader.controller';
import { SampleDocumentController } from './sample-document.service';
import { SchemeDocumentService } from './scheme-reader.service';

/**
 * Reading syllabus PDFs into subjects.
 *
 * The module owns the routes, the services and nothing else. The AI module
 * provides the reader; the storage module provides the file store.
 */
@Module({
  imports: [AiModule, StorageModule],
  controllers: [SchemeReaderController, SampleDocumentController],
  providers: [SchemeDocumentService],
  exports: [SchemeDocumentService],
})
export class SchemeReaderModule {}
