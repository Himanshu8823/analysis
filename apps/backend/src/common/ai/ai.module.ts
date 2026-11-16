/**
 * The AI module.
 *
 * It owns everything that talks to a model provider: the client, the reader
 * and the errors they raise. It is imported by the modules that need it —
 * the upload module, for reading a syllabus PDF — and by nothing else.
 *
 * The module is deliberately small and does not register itself globally.
 * A feature that uses a model is optional: the app starts and works
 * without it, and the exam cell can always enter a scheme by hand.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SchemeReaderService } from './scheme-reader.service';
import { DocumentGuardService } from './document-guard.service';

@Module({
  imports: [ConfigModule],
  providers: [SchemeReaderService, DocumentGuardService],
  exports: [SchemeReaderService, DocumentGuardService],
})
export class AiModule {}
