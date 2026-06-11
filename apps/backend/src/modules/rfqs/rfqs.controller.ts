import {
  CheckRfqAvailabilityDto,
  ConfirmRfqCoverageDto,
  CreateRfqDto,
  RfqListQueryDto,
  SaveRfqDraftDto,
  SendRfqDto,
  UpdateRfqDto,
} from '@forethread/shared-types';
import {
  BadRequestException,
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

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/permissions';
import { toExtractionResponse } from '../doc-intelligence/doc-intelligence.mapper';

import { SubmitQuoteDto, UpdateQuoteDto, UpdateQuoteLineItemStatusDto } from './quote-response.dto';
import { QuoteResponseService } from './quote-response.service';
import { RfqAvailabilityService } from './rfq-availability.service';
import { RfqExportService } from './rfq-export.service';
import type { UpdateLineItemDto } from './rfqs.service';
import { RfqsService } from './rfqs.service';

@ApiTags('RFQs')
@ApiBearerAuth()
@Controller('rfqs')
export class RfqsController {
  constructor(
    private readonly rfqsService: RfqsService,
    private readonly rfqExportService: RfqExportService,
    private readonly quoteResponseService: QuoteResponseService,
    private readonly rfqAvailabilityService: RfqAvailabilityService,
  ) {}

  // ── GET /v1/rfqs ───────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('rfq.list')
  @ApiOperation({ summary: 'List RFQs accessible to the current user' })
  @ApiResponse({ status: 200, description: 'Paginated list of RFQs' })
  async listRfqs(@Query() query: RfqListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rfqsService.listRfqs(query, user);
  }

  // ── POST /v1/rfqs ──────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('rfq.create')
  @ApiOperation({ summary: 'Create a new RFQ' })
  @ApiResponse({ status: 201, description: 'RFQ created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Project or related resource not found' })
  async createRfq(@Body() dto: CreateRfqDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rfqsService.createRfq(dto, user);
  }

  // ── POST /v1/rfqs/draft ──────────────────────────────────────────────────
  // NOTE: Must be before :id routes to avoid NestJS matching "draft" as an id

  @Post('draft')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('rfq.create')
  @ApiOperation({ summary: 'Create a partial RFQ DRAFT (save-as-you-go)' })
  @ApiResponse({ status: 201, description: 'Draft RFQ created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Project or related resource not found' })
  async saveRfqDraft(@Body() dto: SaveRfqDraftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rfqsService.saveRfqDraft(dto, user);
  }

  // ── POST /v1/rfqs/check-availability ─────────────────────────────────────
  // NOTE: Static segment — declared before any :id routes for clarity.

  @Post('check-availability')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('rfq.checkAvailability')
  @ApiOperation({
    summary: 'Check prospective RFQ line items against active bulk orders (US 5.05)',
  })
  @ApiResponse({ status: 200, description: 'Per-line bulk-order matches and the vendors involved' })
  async checkAvailability(
    @Body() dto: CheckRfqAvailabilityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rfqAvailabilityService.checkAvailability(dto, user);
  }

  // ── POST /v1/rfqs/:id/confirm-coverage ───────────────────────────────────

  @Post(':id/confirm-coverage')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('rfq.confirmCoverage')
  @ApiOperation({
    summary:
      'Draw down bulk orders to cover draft-RFQ line items, shrinking or removing them (US 5.05)',
  })
  @ApiResponse({ status: 200, description: 'Updated RFQ detail plus drawdown summary' })
  @ApiResponse({ status: 400, description: 'RFQ not DRAFT or allocation exceeds line quantity' })
  @ApiResponse({ status: 404, description: 'RFQ, line item, or bulk-order line not found' })
  @ApiResponse({ status: 409, description: 'Insufficient remaining quantity on a bulk-order line' })
  async confirmCoverage(
    @Param('id') id: string,
    @Body() dto: ConfirmRfqCoverageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rfqAvailabilityService.confirmCoverage(id, dto, user);
  }

  // ── GET /v1/rfqs/export/:format ────────────────────────────────────────
  // NOTE: Must be before :id route to avoid NestJS matching "export" as an id

  @Get('export/:format')
  @RequirePermissions('rfq.export')
  @ApiOperation({ summary: 'Export RFQs as CSV, PDF, or XLSX' })
  @ApiResponse({ status: 200, description: 'Export file URL' })
  @ApiResponse({ status: 400, description: 'Invalid format' })
  async exportRfqs(
    @Param('format') format: string,
    @Query() query: RfqListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rfqExportService.exportRfqs(format, query, user);
  }

  // ── GET /v1/rfqs/:id ───────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('rfq.read')
  @ApiOperation({ summary: 'Get a single RFQ by ID' })
  @ApiResponse({ status: 200, description: 'RFQ detail' })
  @ApiResponse({ status: 404, description: 'RFQ not found' })
  async getRfq(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rfqsService.getRfq(id, user);
  }

  // ── PATCH /v1/rfqs/:id ─────────────────────────────────────────────────────

  @Patch(':id')
  @RequirePermissions('rfq.update')
  @ApiOperation({ summary: 'Update an RFQ (DRAFT or OPEN with no submitted responses)' })
  @ApiResponse({ status: 200, description: 'RFQ updated' })
  @ApiResponse({ status: 400, description: 'Validation error or invalid status' })
  @ApiResponse({ status: 404, description: 'RFQ not found' })
  async updateRfq(
    @Param('id') id: string,
    @Body() dto: UpdateRfqDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rfqsService.updateRfq(id, dto, user);
  }

  // ── POST /v1/rfqs/:id/send ───────────────────────────────────────────────

  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('rfq.send')
  @ApiOperation({ summary: 'Send a draft RFQ to invited vendors' })
  @ApiResponse({ status: 200, description: 'RFQ sent, status changed to OPEN' })
  @ApiResponse({
    status: 400,
    description: 'RFQ not in DRAFT status or missing line items/vendors',
  })
  @ApiResponse({ status: 404, description: 'RFQ not found' })
  async sendRfq(
    @Param('id') id: string,
    @Body() dto: SendRfqDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rfqsService.sendRfq(id, dto, user);
  }

  // ── DELETE /v1/rfqs/:id ──────────────────────────────────────────────────

  @Delete(':id')
  @RequirePermissions('rfq.cancel')
  @ApiOperation({ summary: 'Cancel (soft-delete) an RFQ' })
  @ApiResponse({ status: 200, description: 'RFQ cancelled' })
  @ApiResponse({ status: 404, description: 'RFQ not found' })
  async cancelRfq(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rfqsService.cancelRfq(id, user);
  }

  // ── POST /v1/rfqs/:id/copy ──────────────────────────────────────────────

  @Post(':id/copy')
  @RequirePermissions('rfq.copy')
  @ApiOperation({ summary: 'Duplicate an RFQ' })
  @ApiResponse({ status: 201, description: 'RFQ duplicated' })
  @ApiResponse({ status: 404, description: 'RFQ not found' })
  async copyRfq(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rfqsService.copyRfq(id, user);
  }

  // ── PATCH /v1/rfqs/:id/archive ─────────────────────────────────────────

  @Patch(':id/archive')
  @RequirePermissions('rfq.archive')
  @ApiOperation({ summary: 'Archive a closed RFQ' })
  @ApiResponse({ status: 200, description: 'RFQ archived' })
  @ApiResponse({ status: 404, description: 'RFQ not found' })
  async archiveRfq(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rfqsService.archiveRfq(id, user);
  }

  // ── PATCH /v1/rfqs/:rfqId/quotes/:quoteId/approve ───────────────────────

  @Patch(':rfqId/quotes/:quoteId/approve')
  @RequirePermissions('rfq.approveQuote')
  @ApiOperation({ summary: 'Approve (award) a quote response' })
  @ApiResponse({ status: 200, description: 'Quote approved' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async approveQuote(
    @Param('rfqId') rfqId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rfqsService.approveQuote(rfqId, quoteId, user);
  }

  // ── POST /v1/rfqs/:rfqId/quotes/:quoteId/award ──────────────────────────

  @Post(':rfqId/quotes/:quoteId/award')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('rfq.approveQuote')
  @ApiOperation({
    summary: 'Award a quote: approve it and auto-create a draft PO from it (FOR-209)',
  })
  @ApiResponse({ status: 201, description: 'Quote awarded; draft PO created' })
  @ApiResponse({ status: 400, description: 'Quote is not in an awardable state' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async awardQuote(
    @Param('rfqId') rfqId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rfqsService.awardQuote(rfqId, quoteId, user);
  }

  // ── PATCH /v1/rfqs/:rfqId/quotes/:quoteId/decline ───────────────────────

  @Patch(':rfqId/quotes/:quoteId/decline')
  @RequirePermissions('rfq.declineQuote')
  @ApiOperation({ summary: 'Decline a quote response' })
  @ApiResponse({ status: 200, description: 'Quote declined' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async declineQuote(
    @Param('rfqId') rfqId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rfqsService.declineQuote(rfqId, quoteId, user);
  }

  // ── PATCH /v1/rfqs/:rfqId/line-items/:lineItemId ─────────────────────────

  @Patch(':rfqId/line-items/:lineItemId')
  @RequirePermissions('rfq.updateLineItem')
  @ApiOperation({ summary: 'Update a line item' })
  @ApiResponse({ status: 200, description: 'Line item updated' })
  @ApiResponse({ status: 404, description: 'Line item not found' })
  async updateLineItem(
    @Param('rfqId') rfqId: string,
    @Param('lineItemId') lineItemId: string,
    @Body() dto: UpdateLineItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rfqsService.updateLineItem(rfqId, lineItemId, dto, user);
  }

  // ── DELETE /v1/rfqs/:rfqId/line-items/:lineItemId ─────────────────────────

  @Delete(':rfqId/line-items/:lineItemId')
  @RequirePermissions('rfq.deleteLineItem')
  @ApiOperation({ summary: 'Delete a line item' })
  @ApiResponse({ status: 200, description: 'Line item deleted' })
  @ApiResponse({ status: 404, description: 'Line item not found' })
  async deleteLineItem(
    @Param('rfqId') rfqId: string,
    @Param('lineItemId') lineItemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rfqsService.deleteLineItem(rfqId, lineItemId, user);
  }

  // ── POST /v1/rfqs/:rfqId/documents ──────────────────────────────────────

  @Post(':rfqId/documents')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('rfq.uploadDocument')
  @ApiOperation({ summary: 'Upload a document to an RFQ' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Document uploaded' })
  @ApiResponse({ status: 404, description: 'RFQ not found' })
  async uploadDocument(
    @Param('rfqId') rfqId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rfqsService.uploadDocument(rfqId, file, user);
  }

  // ── DELETE /v1/rfqs/:rfqId/documents/:docId ─────────────────────────────

  @Delete(':rfqId/documents/:docId')
  @RequirePermissions('rfq.deleteDocument')
  @ApiOperation({ summary: 'Delete an RFQ document' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async deleteDocument(
    @Param('rfqId') rfqId: string,
    @Param('docId') docId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rfqsService.deleteDocument(rfqId, docId, user);
  }

  // ── POST /v1/rfqs/:rfqId/quotes ──────────────────────────────────────────

  @Post(':rfqId/quotes')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('rfq.submitQuote')
  @ApiOperation({ summary: 'Submit a quote response for an RFQ' })
  @ApiResponse({ status: 201, description: 'Quote submitted' })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate quote' })
  @ApiResponse({ status: 403, description: 'Not invited or not a vendor' })
  @ApiResponse({ status: 404, description: 'RFQ not found' })
  async submitQuote(
    @Param('rfqId') rfqId: string,
    @Body() dto: SubmitQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.quoteResponseService.submitQuote(rfqId, dto, user);

    // Notify contractor that a new quote was submitted (fire-and-forget)
    const vendorName = result.vendor?.legalName ?? 'A vendor';
    void this.rfqsService.notifyContractorOfQuoteSubmission(rfqId, vendorName);

    return result;
  }

  // ── PATCH /v1/rfqs/:rfqId/quotes/:quoteId ────────────────────────────────

  @Patch(':rfqId/quotes/:quoteId')
  @RequirePermissions('rfq.updateQuote')
  @ApiOperation({ summary: 'Update a submitted quote response' })
  @ApiResponse({ status: 200, description: 'Quote updated' })
  @ApiResponse({ status: 400, description: 'Validation error or RFQ closed' })
  @ApiResponse({ status: 403, description: 'Not the quote owner' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async updateQuote(
    @Param('rfqId') rfqId: string,
    @Param('quoteId') quoteId: string,
    @Body() dto: UpdateQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.quoteResponseService.updateQuote(rfqId, quoteId, dto, user);

    // Notify contractor that vendor edited their response (fire-and-forget)
    const vendorName = result.vendor?.legalName ?? 'A vendor';
    void this.rfqsService.notifyContractorOfQuoteUpdate(rfqId, vendorName);

    return result;
  }

  // ── GET /v1/rfqs/:rfqId/quotes/:quoteId ──────────────────────────────────

  @Get(':rfqId/quotes/:quoteId')
  @RequirePermissions('rfq.readQuoteDetail')
  @ApiOperation({ summary: 'Get quote response detail' })
  @ApiResponse({ status: 200, description: 'Quote detail' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async getQuoteDetail(
    @Param('rfqId') rfqId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quoteResponseService.getQuoteDetail(rfqId, quoteId, user);
  }

  // ── PATCH /v1/rfqs/:rfqId/quotes/:quoteId/line-items/status ─────────────

  @Patch(':rfqId/quotes/:quoteId/line-items/status')
  @RequirePermissions('rfq.approveQuote')
  @ApiOperation({
    summary: 'Approve / decline / restore individual lines of a quote (US 5.19)',
  })
  @ApiResponse({ status: 200, description: 'Line statuses updated' })
  @ApiResponse({ status: 403, description: 'Access denied (contractor-only)' })
  @ApiResponse({ status: 404, description: 'Quote or line item not found' })
  async updateQuoteLineItemStatuses(
    @Param('rfqId') rfqId: string,
    @Param('quoteId') quoteId: string,
    @Body() dto: UpdateQuoteLineItemStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quoteResponseService.updateQuoteLineItemStatuses(rfqId, quoteId, dto, user);
  }

  // ── GET /v1/rfqs/:rfqId/quote-audit ──────────────────────────────────────

  @Get(':rfqId/quote-audit')
  @RequirePermissions('rfq.read')
  @ApiOperation({ summary: 'Get the quote audit trail for an RFQ (FOR-207)' })
  @ApiResponse({ status: 200, description: 'Quote audit entries (newest first)' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'RFQ not found' })
  async getQuoteAudit(@Param('rfqId') rfqId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quoteResponseService.getQuoteAudit(rfqId, user);
  }

  // ── GET /v1/rfqs/:rfqId/quote-comparison ─────────────────────────────────

  @Get(':rfqId/quote-comparison')
  @RequirePermissions('rfq.read')
  @ApiOperation({ summary: 'Side-by-side comparison of received quotes for an RFQ (FOR-208)' })
  @ApiResponse({ status: 200, description: 'Comparison grid: line items × vendors' })
  @ApiResponse({ status: 403, description: 'Access denied (contractor-only)' })
  @ApiResponse({ status: 404, description: 'RFQ not found' })
  async getQuoteComparison(@Param('rfqId') rfqId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quoteResponseService.getQuoteComparison(rfqId, user);
  }

  // ── Guest (invitation-link) endpoints ──────────────────────────────────────

  // Declared before `GET invitation/:token` so the static `quote-extraction`
  // segment is not swallowed by the `:token` wildcard.
  @Get('invitation/quote-extraction/:id')
  @Public()
  @ApiOperation({
    summary: 'Poll a guest quote PDF extraction by id (no auth required)',
  })
  @ApiResponse({ status: 200, description: 'Quote extraction status / result' })
  @ApiResponse({ status: 404, description: 'Extraction not found' })
  async getGuestQuoteExtraction(@Param('id') id: string) {
    const job = await this.quoteResponseService.getGuestQuoteExtraction(id);
    return toExtractionResponse(job);
  }

  @Post('invitation/:token/quote-extraction')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload a quote PDF and start a Gemini extraction (no auth required)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Extraction job created (PENDING/PROCESSING)' })
  @ApiResponse({ status: 400, description: 'Invalid file or RFQ not open' })
  @ApiResponse({ status: 404, description: 'Invalid or expired invitation token' })
  async createGuestQuoteExtraction(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const job = await this.quoteResponseService.createGuestQuoteExtraction(token, file);
    return toExtractionResponse(job);
  }

  @Get('invitation/:token')
  @Public()
  @ApiOperation({ summary: 'Get RFQ details via invitation token (no auth required)' })
  @ApiResponse({ status: 200, description: 'RFQ detail for guest vendor' })
  @ApiResponse({ status: 404, description: 'Invalid or expired invitation token' })
  async getGuestRfq(@Param('token') token: string) {
    return this.quoteResponseService.getGuestRfq(token);
  }

  @Post('invitation/:token/quote')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a quote via invitation token (no auth required)' })
  @ApiResponse({ status: 201, description: 'Quote submitted' })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate quote' })
  @ApiResponse({ status: 404, description: 'Invalid or expired invitation token' })
  async submitGuestQuote(@Param('token') token: string, @Body() dto: SubmitQuoteDto) {
    return this.quoteResponseService.submitGuestQuote(token, dto);
  }
}
