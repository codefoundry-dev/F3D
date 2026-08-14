import { Module } from '@nestjs/common';

import { ApprovalsModule } from '../approvals/approvals.module';
import { AuditModule } from '../audit/audit.module';
import { ExportModule } from '../export/export.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { MaterialRequestsController } from './material-requests.controller';
import { MaterialRequestsService } from './material-requests.service';

@Module({
  // PrismaService + PermissionsService are provided by their @Global() modules;
  // AuditService and InventoryService need explicit imports. RFQ/PO drafts are
  // created via a direct, scoped prisma.$transaction in the service (no
  // cross-module service dependency), which keeps the convert flow self-contained.
  // InventoryService is the push-out hook used when an MR is approved.
  // ApprovalsModule + NotificationsModule (EmailService) + ExportModule
  // (BrandingService) power the FOR-347 approver routing on submission.
  imports: [AuditModule, InventoryModule, ApprovalsModule, NotificationsModule, ExportModule],
  controllers: [MaterialRequestsController],
  providers: [MaterialRequestsService],
  exports: [MaterialRequestsService],
})
export class MaterialRequestsModule {}
