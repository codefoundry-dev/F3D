import { BulkApproveInvoicesDto, InvoiceListQueryDto } from '@forethread/shared-types';
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

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import { InvoiceExportService } from './invoice-export.service';
import { InvoicesService } from './invoices.service';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoiceExportService: InvoiceExportService,
  ) {}

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

  // ── PATCH /v1/invoices/:id/approve ─────────────────────────────────────────

  @Patch(':id/approve')
  @RequirePermissions('invoice.approve')
  @ApiOperation({ summary: 'Approve a pending invoice' })
  @ApiResponse({ status: 200, description: 'Invoice approved' })
  @ApiResponse({ status: 400, description: 'Invoice is not in Pending status' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async approveInvoice(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.approveInvoice(id, user);
  }

  // ── PATCH /v1/invoices/:id/reject ──────────────────────────────────────────

  @Patch(':id/reject')
  @RequirePermissions('invoice.reject')
  @ApiOperation({ summary: 'Reject a pending or disputed invoice' })
  @ApiResponse({ status: 200, description: 'Invoice rejected' })
  @ApiResponse({ status: 400, description: 'Invoice cannot be rejected in its current status' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async rejectInvoice(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.rejectInvoice(id, user);
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
