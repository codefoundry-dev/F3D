import {
  ApproveInvoiceDto,
  BulkApproveInvoicesDto,
  InvoiceListQueryDto,
  PreviewInvoicePoMatchDto,
  RejectInvoiceDto,
  ReviewInvoiceDto,
} from '@forethread/shared-types';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApprovalEntityType } from '@prisma/client';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';
import { NominateApproversDto } from '../approvals/approvals.dto';
import { ApprovalsService } from '../approvals/approvals.service';

import { InvoiceExportService } from './invoice-export.service';
import { InvoiceIntakeService } from './invoice-intake.service';
import { InvoiceMatchingService } from './invoice-matching.service';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoiceExportService: InvoiceExportService,
    private readonly invoiceIntakeService: InvoiceIntakeService,
    private readonly invoiceMatchingService: InvoiceMatchingService,
    private readonly approvalsService: ApprovalsService,
  ) {}

  // ── POST /v1/invoices/upload ───────────────────────────────────────────────

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('invoice.upload')
  @ApiOperation({ summary: 'Upload an invoice file, creating a new Pending invoice (FOR-290)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Invoice created from the uploaded file' })
  @ApiResponse({ status: 400, description: 'Missing, oversized, or unsupported file' })
  async uploadInvoice(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoiceIntakeService.uploadInvoice(file, user);
  }

  // ── GET /v1/invoices/intake-address ────────────────────────────────────────
  // NOTE: Must be before :id route to avoid NestJS matching "intake-address" as an id

  @Get('intake-address')
  @RequirePermissions('invoice.upload')
  @ApiOperation({ summary: "Get the company's invoice-intake email address (FOR-290)" })
  @ApiResponse({ status: 200, description: 'Intake address, or email: null when not configured' })
  async getIntakeAddress(@CurrentUser() user: AuthenticatedUser) {
    return this.invoiceIntakeService.getIntakeAddress(user);
  }

  // ── GET /v1/invoices/export/:format ─────────────────────────────────────
  // NOTE: Must be before :id route to avoid NestJS matching "export" as an id

  @Get('export/:format')
  @RequirePermissions('invoice.export')
  @ApiOperation({ summary: 'Export invoices as CSV, PDF, or XLSX' })
  @ApiResponse({ status: 200, description: 'Export file URL' })
  @ApiResponse({ status: 400, description: 'Invalid format' })
  async exportInvoices(
    @Param('format') format: string,
    @Query() query: InvoiceListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoiceExportService.exportInvoices(format, query, user);
  }

  // ── GET /v1/invoices/:id/export/:format ───────────────────────────────────

  @Get(':id/export/:format')
  @RequirePermissions('invoice.exportSingle')
  @ApiOperation({ summary: 'Export a single invoice as CSV, PDF, or XLSX' })
  @ApiResponse({ status: 200, description: 'Export file URL' })
  @ApiResponse({ status: 400, description: 'Invalid format' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async exportSingleInvoice(
    @Param('id') id: string,
    @Param('format') format: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoiceExportService.exportSingleInvoice(id, format, user);
  }

  // ── GET /v1/invoices ───────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('invoice.list')
  @ApiOperation({ summary: 'List invoices accessible to the current user' })
  @ApiResponse({ status: 200, description: 'Paginated list of invoices' })
  async listInvoices(@Query() query: InvoiceListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.listInvoices(query, user);
  }

  // ── GET /v1/invoices/:id ───────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('invoice.read')
  @ApiOperation({ summary: 'Get a single invoice by ID' })
  @ApiResponse({ status: 200, description: 'Invoice detail' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoice(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.getInvoice(id, user);
  }

  // ── GET /v1/invoices/:id/po-match ──────────────────────────────────────────

  @Get(':id/po-match')
  @RequirePermissions('invoice.review')
  @ApiOperation({
    summary:
      'Reconcile the invoice against its PO: per-line price/quantity variance and unexpected-line flags (FOR-293)',
  })
  @ApiResponse({ status: 200, description: 'Match report for the reviewer' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getPoMatch(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('poId') poId?: string,
  ) {
    // `poId` previews the reconciliation against a PO the reviewer has selected in
    // the form but not yet saved, so the PO's status, delivery progress and lines
    // can be compared before committing to the link. A PO outside the invoice's
    // company is ignored, not an error.
    return this.invoiceMatchingService.getPoMatch(id, user, poId === '' ? undefined : poId);
  }

  // ── POST /v1/invoices/:id/po-match ─────────────────────────────────────────

  @Post(':id/po-match')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('invoice.review')
  @ApiOperation({
    summary:
      "Preview the reconciliation against the review form's current PO pick and unsaved lines",
    description:
      'The same report as GET /po-match, but pairing and variance flags are ' +
      'computed from the lines in the body (the review form as edited so far) ' +
      'instead of the saved invoice lines, so the side-by-side comparison is ' +
      'live before anything is persisted. Nothing is written.',
  })
  @ApiResponse({ status: 200, description: 'Match report for the draft lines' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async previewPoMatch(
    @Param('id') id: string,
    @Body() dto: PreviewInvoicePoMatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoiceMatchingService.getPoMatch(
      id,
      user,
      dto.poId === '' || dto.poId === null ? undefined : dto.poId,
      dto.lines,
    );
  }

  // ── GET /v1/invoices/:id/po-info ───────────────────────────────────────────

  @Get(':id/po-info')
  @RequirePermissions('invoice.read')
  @ApiOperation({
    summary:
      "The invoice's resolved PO with reconciliation, plus its recorded delivery reports (FOR-355)",
    description:
      'Gated on invoice.read, not invoice.review: the Invoice Details PO tab is ' +
      'a read surface. `poId` previews the PO the reviewer has picked in the ' +
      'review form but not yet saved; like the po-export override it must ' +
      "belong to the invoice's company, otherwise it is ignored.",
  })
  @ApiResponse({ status: 200, description: 'PO reconciliation + delivery reports' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getPoInfo(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('poId') poId?: string,
  ) {
    return this.invoiceMatchingService.getPoInfo(id, user, poId === '' ? undefined : poId);
  }

  // ── GET /v1/invoices/:id/po-export ─────────────────────────────────────────

  @Get(':id/po-export')
  @RequirePermissions('invoice.read')
  @ApiOperation({
    summary: "Generate the system PDF of the invoice's resolved PO (FOR-355)",
    description:
      'Served through the invoice scope because invoice viewers (finance) do ' +
      "not necessarily hold po.exportSingle. `poId` names the tab's displayed " +
      'PO when it is auto-matched rather than saved; it must belong to the ' +
      "invoice's company.",
  })
  @ApiResponse({ status: 200, description: 'Signed URL of the generated PO PDF' })
  @ApiResponse({ status: 404, description: 'Invoice not found, or no PO to export' })
  async exportRelatedPo(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('poId') poId?: string,
  ) {
    return this.invoiceMatchingService.exportRelatedPoPdf(id, user, poId === '' ? undefined : poId);
  }

  // ── PATCH /v1/invoices/:id/review ──────────────────────────────────────────

  @Patch(':id/review')
  @RequirePermissions('invoice.review')
  @ApiOperation({
    summary: 'Persist reviewer-confirmed/corrected invoice fields and line items (FOR-291)',
  })
  @ApiResponse({ status: 200, description: 'Invoice updated with the reviewed fields' })
  @ApiResponse({ status: 400, description: 'Invoice is not Pending, or a reference is invalid' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async reviewInvoice(
    @Param('id') id: string,
    @Body() dto: ReviewInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.reviewInvoice(id, dto, user);
  }

  // ── GET /v1/invoices/:id/audit ─────────────────────────────────────────────

  @Get(':id/audit')
  @RequirePermissions('invoice.read')
  @ApiOperation({
    summary: 'State history for the invoice — transitions with reasons (FOR-294)',
  })
  @ApiResponse({ status: 200, description: 'Chronological audit entries for the invoice' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoiceAudit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.getAuditTrail(id, user);
  }

  // ── GET /v1/invoices/:id/approver-pool ─────────────────────────────────────

  @Get(':id/approver-pool')
  @RequirePermissions('invoice.read')
  @ApiOperation({
    summary: "The invoice's Approver Pool, its nominees, and who resolved it",
    description:
      'Gated on invoice.read, not invoice.approve: the reviewer needs to see ' +
      'who they are waiting on without holding approval authority themselves. ' +
      'The Pool is recomputed live on every call and never carries a cap amount.',
  })
  @ApiResponse({ status: 200, description: 'Approver Pool view' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoiceApproverPool(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('amount') amount?: string,
  ) {
    // `amount` previews the Pool for a total the reviewer has typed but not yet
    // saved, so the nomination picker never offers someone who cannot approve
    // the figure about to be written (FOR-309).
    const parsed = amount === undefined || amount === '' ? undefined : Number(amount);
    return this.approvalsService.getApproverPool(
      ApprovalEntityType.INVOICE,
      id,
      user,
      parsed === undefined || Number.isNaN(parsed) ? undefined : parsed,
    );
  }

  // ── POST /v1/invoices/:id/nominations ──────────────────────────────────────

  @Post(':id/nominations')
  @RequirePermissions('invoice.read')
  @ApiOperation({
    summary: 'Nominate further Approver Pool members on an invoice awaiting approval',
    description:
      'Routing only — gated on invoice.read because nominating is not an ' +
      'approval act. Only the reviewer may nominate, only while the approval is ' +
      'open, and only Pool members. Re-nominating an existing nominee is a no-op.',
  })
  @ApiResponse({ status: 201, description: 'Updated Approver Pool view' })
  @ApiResponse({ status: 400, description: 'Nominee outside the Pool, or invoice not pending' })
  @ApiResponse({ status: 403, description: 'Caller did not review this invoice' })
  async nominateInvoiceApprovers(
    @Param('id') id: string,
    @Body() dto: NominateApproversDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Through InvoicesService, not ApprovalsService: the nominee has to be
    // notified, and the invoice's email templates live with the invoice.
    return this.invoicesService.nominateApprovers(id, dto.userIds, user);
  }

  // ── DELETE /v1/invoices/:id/nominations/:userId ────────────────────────────

  @Delete(':id/nominations/:userId')
  @RequirePermissions('invoice.read')
  @ApiOperation({
    summary: 'Withdraw a nomination',
    description:
      'Removes the routing hint only. The withdrawn user keeps their place in ' +
      'the Approver Pool and can still approve the invoice.',
  })
  @ApiResponse({ status: 200, description: 'Updated Approver Pool view' })
  @ApiResponse({ status: 404, description: 'No such nomination' })
  async withdrawInvoiceNomination(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalsService.withdrawNomination(ApprovalEntityType.INVOICE, id, userId, user);
  }

  // ── PATCH /v1/invoices/:id/approve ─────────────────────────────────────────

  @Patch(':id/approve')
  @RequirePermissions('invoice.approve')
  @ApiOperation({ summary: 'Approve a pending invoice (optional reason recorded on the trail)' })
  @ApiResponse({ status: 200, description: 'Invoice approved' })
  @ApiResponse({ status: 400, description: 'Invoice is not in Pending status' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async approveInvoice(
    @Param('id') id: string,
    @Body() dto: ApproveInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.approveInvoice(id, dto, user);
  }

  // ── PATCH /v1/invoices/:id/reject ──────────────────────────────────────────

  @Patch(':id/reject')
  @RequirePermissions('invoice.reject')
  @ApiOperation({ summary: 'Reject a pending or disputed invoice' })
  @ApiResponse({ status: 200, description: 'Invoice rejected' })
  @ApiResponse({ status: 400, description: 'Invoice cannot be rejected in its current status' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async rejectInvoice(
    @Param('id') id: string,
    @Body() dto: RejectInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.rejectInvoice(id, dto, user);
  }

  // ── POST /v1/invoices/bulk-approve ─────────────────────────────────────────

  @Post('bulk-approve')
  @RequirePermissions('invoice.bulkApprove')
  @ApiOperation({ summary: 'Bulk approve multiple pending invoices' })
  @ApiResponse({ status: 200, description: 'Invoices approved' })
  @ApiResponse({ status: 400, description: 'No invoice IDs provided' })
  async bulkApproveInvoices(
    @Body() dto: BulkApproveInvoicesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.bulkApproveInvoices(dto.ids, user);
  }

  // ── POST /v1/invoices/:invoiceId/documents ────────────────────────────────

  @Post(':invoiceId/documents')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('invoice.uploadDocument')
  @ApiOperation({ summary: 'Upload a document to an invoice' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Document uploaded' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async uploadDocument(
    @Param('invoiceId') invoiceId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.uploadDocument(invoiceId, file, user);
  }

  // ── DELETE /v1/invoices/:invoiceId/documents/:docId ───────────────────────

  @Delete(':invoiceId/documents/:docId')
  @RequirePermissions('invoice.deleteDocument')
  @ApiOperation({ summary: 'Delete an invoice document' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async deleteDocument(
    @Param('invoiceId') invoiceId: string,
    @Param('docId') docId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.deleteDocument(invoiceId, docId, user);
  }
}
