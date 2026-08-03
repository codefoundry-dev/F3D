import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';

import { AuditModule } from '../audit/audit.module';
import { DocIntelligenceModule } from '../doc-intelligence/doc-intelligence.module';
import { ExportModule } from '../export/export.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

import { InvoiceExportService } from './invoice-export.service';
import { InvoiceIntakeService } from './invoice-intake.service';
import { InvoiceMatchingService } from './invoice-matching.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PaymentReminderService } from './payment-reminder.service';
import { ResendInboundController } from './resend-inbound.controller';

@Module({
  imports: [
    StorageModule,
    ExportModule,
    NotificationsModule,
    DocIntelligenceModule,
    AuditModule,
    MulterModule.register({ storage: multer.memoryStorage() }),
  ],
  controllers: [InvoicesController, ResendInboundController],
  providers: [
    InvoicesService,
    InvoiceExportService,
    InvoiceIntakeService,
    InvoiceMatchingService,
    PaymentReminderService,
  ],
  exports: [InvoicesService],
})
export class InvoicesModule {}
