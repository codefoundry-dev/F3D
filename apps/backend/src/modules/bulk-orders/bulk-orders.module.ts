import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { BulkOrderChangeService } from './bulk-order-change.service';
import { BulkOrdersController } from './bulk-orders.controller';
import { BulkOrdersService } from './bulk-orders.service';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [BulkOrdersController],
  providers: [BulkOrdersService, BulkOrderChangeService],
  exports: [BulkOrdersService, BulkOrderChangeService],
})
export class BulkOrdersModule {}
