import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import { EmailLogService } from './email-log.service';

/**
 * Read endpoints for the per-RFQ / per-PO email delivery log (FOR-213). Auth is
 * the global JWT guard; company scoping is enforced in the service.
 */
@ApiTags('Email Log')
@ApiBearerAuth()
@Controller()
export class EmailLogController {
  constructor(private readonly emailLogService: EmailLogService) {}

  // ── GET /v1/rfqs/:rfqId/emails ─────────────────────────────────────────────

  @Get('rfqs/:rfqId/emails')
  @RequirePermissions('rfq.read')
  @ApiOperation({ summary: 'List the email delivery log for an RFQ' })
  @ApiResponse({ status: 200, description: 'Email log entries for the RFQ' })
  @ApiResponse({ status: 404, description: 'RFQ not found' })
  async listRfqEmails(@Param('rfqId') rfqId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.emailLogService.listForRfq(rfqId, user);
  }

  // ── GET /v1/purchase-orders/:poId/emails ───────────────────────────────────

  @Get('purchase-orders/:poId/emails')
  @RequirePermissions('po.read')
  @ApiOperation({ summary: 'List the email delivery log for a purchase order' })
  @ApiResponse({ status: 200, description: 'Email log entries for the purchase order' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  async listPoEmails(@Param('poId') poId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.emailLogService.listForPurchaseOrder(poId, user);
  }
}
