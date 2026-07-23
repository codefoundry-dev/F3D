import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { ExportModule } from '../export/export.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { BulkOrderChangeService } from './bulk-order-change.service';
import { BulkOrdersController } from './bulk-orders.controller';
import { BulkOrdersService } from './bulk-orders.service';

@Module({
  imports: [AuditModule, ExportModule, NotificationsModule],
  controllers: [BulkOrdersController],
  providers: [BulkOrdersService, BulkOrderChangeService],
  exports: [BulkOrdersService, BulkOrderChangeService],
})
export class BulkOrdersModule {}
