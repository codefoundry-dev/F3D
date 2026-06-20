import { Module } from '@nestjs/common';

import { AccessTokensModule } from '../access-tokens/access-tokens.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { StorageModule } from '../storage/storage.module';

import { DeliveriesPortalController } from './deliveries-portal.controller';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { DeliveryAttachmentService } from './delivery-attachment.service';
import { DeliveryCodeService } from './delivery-code.service';
import { DeliveryPortalService } from './delivery-portal.service';

@Module({
  imports: [
    StorageModule,
    NotificationsModule,
    AuditModule,
    AccessTokensModule,
    // PurchaseOrdersModule exports PoStatusService — the delivery-report approval
    // path reuses its shared close-out leg (applyDeliveryDeltasInTx).
    PurchaseOrdersModule,
  ],
  controllers: [DeliveriesController, DeliveriesPortalController],
  providers: [
    DeliveriesService,
    DeliveryPortalService,
    DeliveryCodeService,
    DeliveryAttachmentService,
  ],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
