import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';

import { MaterialRequestsController } from './material-requests.controller';
import { MaterialRequestsService } from './material-requests.service';

@Module({
  // PrismaService + PermissionsService are provided by their @Global() modules;
  // only AuditService needs an explicit import. RFQ/PO drafts are created via a
  // direct, scoped prisma.$transaction in the service (no cross-module service
  // dependency), which keeps the convert flow self-contained.
  imports: [AuditModule],
  controllers: [MaterialRequestsController],
  providers: [MaterialRequestsService],
  exports: [MaterialRequestsService],
})
export class MaterialRequestsModule {}
