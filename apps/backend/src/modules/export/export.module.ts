import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';

import { BrandingService } from './branding.service';
import { PdfExportService } from './pdf-export.service';

@Module({
  imports: [StorageModule],
  providers: [PdfExportService, BrandingService],
  exports: [PdfExportService, BrandingService],
})
export class ExportModule {}
