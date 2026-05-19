import {
  CreatePurchaseOrderDto,
  PoListQueryDto,
  UpdatePurchaseOrderDto,
  ValidatePoItemsDto,
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

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';

import { CreatePoChangeRequestDto, RejectPoChangeRequestDto } from './po-change.dto';
import { PoChangeService } from './po-change.service';
import { PoDocumentService } from './po-document.service';
import { PoExportService } from './po-export.service';
import { PoStatusService } from './po-status.service';
import { PoValidationService } from './po-validation.service';
import { VendorAcceptPoDto, VendorDeclinePoDto } from './po-vendor.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly poExportService: PoExportService,
    private readonly poDocumentService: PoDocumentService,
    private readonly poStatusService: PoStatusService,
    private readonly poValidationService: PoValidationService,
    private readonly poChangeService: PoChangeService,
  ) {}

  // ── GET /v1/purchase-orders ────────────────────────────────────────────────

  @Get()
  @Roles(
    UserRole.COMPANY_ADMIN,
    UserRole.PROCUREMENT_OFFICER,
    UserRole.FINANCIAL_OFFICER,
    UserRole.VENDOR,
  )
  @ApiOperation({ summary: 'List purchase orders accessible to the current user' })
  @ApiResponse({ status: 200, description: 'Paginated list of purchase orders' })
  async listPurchaseOrders(@Query() query: PoListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseOrdersService.listPurchaseOrders(query, user);
  }

  // ── POST /v1/purchase-orders ──────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER)
  @ApiOperation({ summary: 'Create a new purchase order' })
  @ApiResponse({ status: 201, description: 'Purchase order created' })
  async createPurchaseOrder(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchaseOrdersService.createPurchaseOrder(dto, user);
  }

  // ── POST /v1/purchase-orders/validate-items ────────────────────────────

  @Post('validate-items')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER)
  @ApiOperation({ summary: 'Check line items against bulk orders and approved RFQs' })
  @ApiResponse({ status: 200, description: 'Validation suggestions' })
  async validateItems(@Body() dto: ValidatePoItemsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.poValidationService.validateItems(dto, user);
  }

  // ── PATCH /v1/purchase-orders/:id ───────────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER)
  @ApiOperation({ summary: 'Update a draft purchase order' })
  @ApiResponse({ status: 200, description: 'Purchase order updated' })
  @ApiResponse({ status: 400, description: 'PO is not in DRAFT status' })
  @ApiResponse({ status: 404, description: 'PO not found' })
  async updatePurchaseOrder(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchaseOrdersService.updatePurchaseOrder(id, dto, user);
  }

  // ── POST /v1/purchase-orders/:id/issue ──────────────────────────────────

  @Post(':id/issue')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER)
  @ApiOperation({ summary: 'Issue a draft purchase order (DRAFT → SENT)' })
  @ApiResponse({ status: 200, description: 'Purchase order issued' })
  @ApiResponse({ status: 400, description: 'PO is not in DRAFT status' })
  @ApiResponse({ status: 404, description: 'PO not found' })
  async issuePurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.poStatusService.issuePurchaseOrder(id, user);
  }

  // ── POST /v1/purchase-orders/:id/confirm ──────────────────────────────────

  @Post(':id/confirm')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Vendor confirms receipt of a purchase order' })
  @ApiResponse({ status: 200, description: 'PO confirmed by vendor' })
  @ApiResponse({ status: 400, description: 'PO is not in SENT status' })
  @ApiResponse({ status: 404, description: 'PO not found' })
  async confirmPurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.poStatusService.confirmPurchaseOrder(id, user);
  }

  // ── PATCH /v1/purchase-orders/:id/accept ──────────────────────────────────

  @Patch(':id/accept')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Vendor accepts a purchase order (ACKNOWLEDGED → ACCEPTED)' })
  @ApiResponse({ status: 200, description: 'PO accepted by vendor' })
  @ApiResponse({ status: 400, description: 'PO is not in ACKNOWLEDGED status' })
  @ApiResponse({ status: 404, description: 'PO not found' })
  async acceptPurchaseOrder(
    @Param('id') id: string,
    @Body() dto: VendorAcceptPoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.poStatusService.acceptPurchaseOrder(id, dto, user);
  }

  // ── PATCH /v1/purchase-orders/:id/vendor-decline ──────────────────────────

  @Patch(':id/vendor-decline')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Vendor declines a purchase order' })
  @ApiResponse({ status: 200, description: 'PO declined by vendor' })
  @ApiResponse({ status: 400, description: 'PO cannot be declined in current status' })
  @ApiResponse({ status: 404, description: 'PO not found' })
  async vendorDeclinePurchaseOrder(
    @Param('id') id: string,
    @Body() dto: VendorDeclinePoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.poStatusService.vendorDeclinePurchaseOrder(id, dto, user);
  }

  // ── GET /v1/purchase-orders/export/:format ────────────────────────────────

  @Get('export/:format')
  @Roles(
    UserRole.COMPANY_ADMIN,
    UserRole.PROCUREMENT_OFFICER,
    UserRole.FINANCIAL_OFFICER,
    UserRole.VENDOR,
  )
  @ApiOperation({ summary: 'Export purchase orders as CSV, XLSX, or PDF' })
  @ApiResponse({ status: 200, description: 'Export file URL' })
  async exportPurchaseOrders(
    @Param('format') format: string,
    @Query() query: PoListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.poExportService.exportPos(format, query, user);
  }

  // ── GET /v1/purchase-orders/:id/export/:format ────────────────────────────

  @Get(':id/export/:format')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Export a single purchase order as PDF' })
  @ApiResponse({ status: 200, description: 'Export file URL' })
  async exportSinglePo(
    @Param('id') id: string,
    @Param('format') format: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.poExportService.exportSinglePo(id, format, user);
  }

  // ── POST /v1/purchase-orders/:poId/documents ─────────────────────────────

  @Post(':poId/documents')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Upload a document to a purchase order' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Document uploaded' })
  @ApiResponse({ status: 404, description: 'PO not found' })
  async uploadDocument(
    @Param('poId') poId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.poDocumentService.uploadDocument(poId, file, user);
  }

  // ── DELETE /v1/purchase-orders/:poId/documents/:docId ───────────────────

  @Delete(':poId/documents/:docId')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Delete a PO document' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async deleteDocument(
    @Param('poId') poId: string,
    @Param('docId') docId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.poDocumentService.deleteDocument(poId, docId, user);
  }

  // ── POST /v1/purchase-orders/:id/copy ─────────────────────────────────────

  @Post(':id/copy')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER)
  @ApiOperation({ summary: 'Duplicate a purchase order as a new Draft' })
  @ApiResponse({ status: 201, description: 'PO duplicated' })
  @ApiResponse({ status: 404, description: 'PO not found' })
  async copyPurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseOrdersService.copyPurchaseOrder(id, user);
  }

  // ── PATCH /v1/purchase-orders/:id/archive ───────────────────────────────

  @Patch(':id/archive')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER)
  @ApiOperation({ summary: 'Archive a closed purchase order' })
  @ApiResponse({ status: 200, description: 'PO archived' })
  @ApiResponse({ status: 400, description: 'PO is not in CLOSED status' })
  @ApiResponse({ status: 404, description: 'PO not found' })
  async archivePurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.poStatusService.archivePurchaseOrder(id, user);
  }

  // ── GET /v1/purchase-orders/:id ────────────────────────────────────────────

  @Get(':id')
  @Roles(
    UserRole.COMPANY_ADMIN,
    UserRole.PROCUREMENT_OFFICER,
    UserRole.FINANCIAL_OFFICER,
    UserRole.VENDOR,
  )
  @ApiOperation({ summary: 'Get a single purchase order by ID' })
  @ApiResponse({ status: 200, description: 'Purchase order detail' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  async getPurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseOrdersService.getPurchaseOrder(id, user);
  }

  // ── PATCH /v1/purchase-orders/:id/approve ────────────────────────────────

  @Patch(':id/approve')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER)
  @ApiOperation({ summary: 'Approve a purchase order' })
  @ApiResponse({ status: 200, description: 'PO approved' })
  @ApiResponse({ status: 400, description: 'PO cannot be approved in its current status' })
  @ApiResponse({ status: 404, description: 'PO not found' })
  async approvePurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.poStatusService.approvePurchaseOrder(id, user);
  }

  // ── PATCH /v1/purchase-orders/:id/decline ────────────────────────────────

  @Patch(':id/decline')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER)
  @ApiOperation({ summary: 'Decline a purchase order' })
  @ApiResponse({ status: 200, description: 'PO declined' })
  @ApiResponse({ status: 400, description: 'PO cannot be declined in its current status' })
  @ApiResponse({ status: 404, description: 'PO not found' })
  async declinePurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.poStatusService.declinePurchaseOrder(id, user);
  }

  // ── PO Change Request endpoints ────────────────────────────────────────────

  @Post(':id/change-requests')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Propose a change to a purchase order' })
  @ApiResponse({ status: 201, description: 'Change request created' })
  async proposePoChange(
    @Param('id') id: string,
    @Body() dto: CreatePoChangeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.poChangeService.proposeChange(id, dto, user);
  }

  @Get(':id/change-requests')
  @Roles(
    UserRole.COMPANY_ADMIN,
    UserRole.PROCUREMENT_OFFICER,
    UserRole.FINANCIAL_OFFICER,
    UserRole.VENDOR,
  )
  @ApiOperation({ summary: 'List change requests for a purchase order' })
  @ApiResponse({ status: 200, description: 'List of change requests' })
  async listPoChangeRequests(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.poChangeService.listChangeRequests(id, user);
  }

  @Patch(':id/change-requests/:crId/approve')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Approve a PO change request' })
  @ApiResponse({ status: 200, description: 'Change request approved' })
  async approvePoChange(
    @Param('id') id: string,
    @Param('crId') crId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.poChangeService.approveChange(id, crId, user);
  }

  @Patch(':id/change-requests/:crId/reject')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.PROCUREMENT_OFFICER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Reject a PO change request' })
  @ApiResponse({ status: 200, description: 'Change request rejected' })
  async rejectPoChange(
    @Param('id') id: string,
    @Param('crId') crId: string,
    @Body() dto: RejectPoChangeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.poChangeService.rejectChange(id, crId, dto, user);
  }
}
