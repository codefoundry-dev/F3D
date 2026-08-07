import { Module } from '@nestjs/common';

import { ApprovalsService } from './approvals.service';

/**
 * Approver Pool + Nomination, shared by the Purchase Order and Invoice modules
 * (ADR-0006 amendment). Exposes no controller of its own — the routes hang off
 * each document's own controller so they stay RESTful, and both delegate here.
 */
@Module({
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
