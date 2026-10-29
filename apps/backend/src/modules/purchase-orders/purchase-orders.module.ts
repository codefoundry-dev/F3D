import { Module } from '@nestjs/common';

import { AccessTokensModule } from '../access-tokens/access-tokens.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AuditModule } from '../audit/audit.module';
import { ExportModule } from '../export/export.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';

import { PoChangeService } from './po-change.service';
import { PoDeliveryScheduleService } from './po-delivery-schedule.service';
import { PoDocumentService } from './po-document.service';
import { PoExportService } from './po-export.service';
import { PoStatusService } from './po-status.service';
import { PoValidationService } from './po-validation.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';

@Module({
  imports: [
    ExportModule,
    StorageModule,
    NotificationsModule,
    AuditModule,
    InventoryModule,
    AccessTokensModule,
    ApprovalsModule,
  ],
  controllers: [PurchaseOrdersController],
  providers: [
    PurchaseOrdersService,
    PoExportService,
    PoDocumentService,
    PoStatusService,
    PoValidationService,
    PoChangeService,
    PoDeliveryScheduleService,
  ],
  // PoExportService: the invoices module serves the linked PO's PDF through the
  // invoice scope (FOR-355).
  exports: [PurchaseOrdersService, PoStatusService, PoExportService],
})
export class PurchaseOrdersModule {}
