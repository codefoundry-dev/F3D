import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';

import { PdfExportService } from './pdf-export.service';

@Module({
  imports: [StorageModule],
  providers: [PdfExportService],
  exports: [PdfExportService],
})
export class ExportModule {}
