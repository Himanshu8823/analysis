import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { FileAccessService } from './file-access.service';
import { FilesController } from './files.controller';

@Global()
@Module({
  controllers: [FilesController],
  providers: [StorageService, FileAccessService],
  exports: [StorageService, FileAccessService],
})
export class StorageModule {}
