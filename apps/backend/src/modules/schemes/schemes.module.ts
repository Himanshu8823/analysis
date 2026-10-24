import { Module } from '@nestjs/common';
import { SchemesController } from './schemes.controller';
import { SchemesService } from './schemes.service';
import { SchemesRepository } from './schemes.repository';

@Module({
  controllers: [SchemesController],
  providers: [SchemesService, SchemesRepository],
  exports: [SchemesService],
})
export class SchemesModule {}