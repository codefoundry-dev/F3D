import { Module } from '@nestjs/common';

import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

/**
 * Inventory movement engine (Epic 7). PrismaService is provided by its
 * @Global() module, so no imports are needed. InventoryService is exported so
 * the PO-receipt (push-in) and MR-approval (push-out) hooks can inject it.
 */
@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
