import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';

import { ExportModule } from '../export/export.module';
import { StorageModule } from '../storage/storage.module';

import { InvoiceExportService } from './invoice-export.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [
    StorageModule,
    ExportModule,
    MulterModule.register({ storage: multer.memoryStorage() }),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceExportService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
