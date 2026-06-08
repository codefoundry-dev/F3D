import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ExportModule } from '../export/export.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

import { PoChangeService } from './po-change.service';
import { PoDocumentService } from './po-document.service';
import { PoExportService } from './po-export.service';
import { PoStatusService } from './po-status.service';
import { PoValidationService } from './po-validation.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';

@Module({
  imports: [ExportModule, StorageModule, NotificationsModule, AuditModule],
  controllers: [PurchaseOrdersController],
  providers: [
    PurchaseOrdersService,
    PoExportService,
    PoDocumentService,
    PoStatusService,
    PoValidationService,
    PoChangeService,
  ],
  exports: [PurchaseOrdersService, PoStatusService],
})
export class PurchaseOrdersModule {}
