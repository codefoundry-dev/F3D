import {
  BulkOrderListQueryDto,
  CreateBulkOrderDto,
  CreateDrawdownDto,
  UpdateBulkOrderDto,
  UpdateBulkOrderLineItemDto,
} from '@forethread/shared-types';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import { CreateBulkOrderChangeRequestDto, RejectChangeRequestDto } from './bulk-order-change.dto';
import { BulkOrderChangeService } from './bulk-order-change.service';
import { BulkOrdersService } from './bulk-orders.service';

@ApiTags('Bulk Orders')
@ApiBearerAuth()
@Controller('bulk-orders')
export class BulkOrdersController {
  constructor(
    private readonly bulkOrdersService: BulkOrdersService,
    private readonly bulkOrderChangeService: BulkOrderChangeService,
  ) {}

  // ── GET /v1/bulk-orders ────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('bulkOrder.list')
  @ApiOperation({ summary: 'List bulk orders accessible to the current user' })
  @ApiResponse({ status: 200, description: 'Paginated list of bulk orders' })
  async listBulkOrders(
    @Query() query: BulkOrderListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bulkOrdersService.listBulkOrders(query, user);
  }

  // ── POST /v1/bulk-orders ───────────────────────────────────────────────────

  @Post()
  @RequirePermissions('bulkOrder.create')
  @ApiOperation({ summary: 'Create a new bulk order' })
  @ApiResponse({ status: 201, description: 'Bulk order created' })
  async createBulkOrder(@Body() dto: CreateBulkOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bulkOrdersService.createBulkOrder(dto, user);
  }

  // ── GET /v1/bulk-orders/:id ────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('bulkOrder.read')
  @ApiOperation({ summary: 'Get a single bulk order by ID' })
  @ApiResponse({ status: 200, description: 'Bulk order detail with line items' })
  @ApiResponse({ status: 404, description: 'Bulk order not found' })
  async getBulkOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bulkOrdersService.getBulkOrder(id, user);
  }

  // ── PATCH /v1/bulk-orders/:id ──────────────────────────────────────────────

  @Patch(':id')
  @RequirePermissions('bulkOrder.update')
  @ApiOperation({ summary: 'Update a bulk order (brands, endDate, status)' })
  @ApiResponse({ status: 200, description: 'Bulk order updated' })
  async updateBulkOrder(
    @Param('id') id: string,
    @Body() dto: UpdateBulkOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bulkOrdersService.updateBulkOrder(id, dto, user);
  }

  // ── DELETE /v1/bulk-orders/:id ─────────────────────────────────────────────

  @Delete(':id')
  @RequirePermissions('bulkOrder.delete')
  @ApiOperation({ summary: 'Delete a bulk order' })
  @ApiResponse({ status: 200, description: 'Bulk order deleted' })
  async deleteBulkOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bulkOrdersService.deleteBulkOrder(id, user);
  }

  // ── PATCH /v1/bulk-orders/:id/line-items/:lineItemId ───────────────────────

  @Patch(':id/line-items/:lineItemId')
  @RequirePermissions('bulkOrder.updateLineItem')
  @ApiOperation({ summary: 'Update a single line item in a bulk order' })
  @ApiResponse({ status: 200, description: 'Line item updated' })
  async updateLineItem(
    @Param('id') id: string,
    @Param('lineItemId') lineItemId: string,
    @Body() dto: UpdateBulkOrderLineItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bulkOrdersService.updateLineItem(id, lineItemId, dto, user);
  }

  // ── POST /v1/bulk-orders/:id/drawdowns ─────────────────────────────────────

  @Post(':id/drawdowns')
  @RequirePermissions('bulkOrder.createDrawdown')
  @ApiOperation({ summary: 'Create a drawdown from a bulk order line item' })
  @ApiResponse({ status: 201, description: 'Drawdown created' })
  async createDrawdown(
    @Param('id') id: string,
    @Body() dto: CreateDrawdownDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bulkOrdersService.createDrawdown(id, dto, user);
  }

  // ── POST /v1/bulk-orders/:id/change-requests ─────────────────────────────

  @Post(':id/change-requests')
  @RequirePermissions('bulkOrder.proposeChange')
  @ApiOperation({ summary: 'Propose changes to an active bulk agreement' })
  @ApiResponse({ status: 201, description: 'Change request created' })
  async proposeChange(
    @Param('id') id: string,
    @Body() dto: CreateBulkOrderChangeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bulkOrderChangeService.proposeChange(id, dto, user);
  }

  // ── GET /v1/bulk-orders/:id/change-requests ──────────────────────────────

  @Get(':id/change-requests')
  @RequirePermissions('bulkOrder.listChangeRequests')
  @ApiOperation({ summary: 'List change requests for a bulk order' })
  @ApiResponse({ status: 200, description: 'List of change requests' })
  async listChangeRequests(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bulkOrderChangeService.listChangeRequests(id, user);
  }

  // ── PATCH /v1/bulk-orders/:id/change-requests/:crId/approve ──────────────

  @Patch(':id/change-requests/:crId/approve')
  @RequirePermissions('bulkOrder.approveChange')
  @ApiOperation({ summary: 'Approve a pending change proposal' })
  @ApiResponse({ status: 200, description: 'Change request approved, bulk order updated' })
  async approveChange(
    @Param('id') id: string,
    @Param('crId') crId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bulkOrderChangeService.approveChange(id, crId, user);
  }

  // ── PATCH /v1/bulk-orders/:id/change-requests/:crId/reject ───────────────

  @Patch(':id/change-requests/:crId/reject')
  @RequirePermissions('bulkOrder.rejectChange')
  @ApiOperation({ summary: 'Reject a change proposal with optional reason' })
  @ApiResponse({ status: 200, description: 'Change request rejected' })
  async rejectChange(
    @Param('id') id: string,
    @Param('crId') crId: string,
    @Body() dto: RejectChangeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bulkOrderChangeService.rejectChange(id, crId, dto, user);
  }

  // ── POST /v1/bulk-orders/:id/cancel ──────────────────────────────────────

  @Post(':id/cancel')
  @RequirePermissions('bulkOrder.cancel')
  @ApiOperation({ summary: 'Cancel a bulk agreement' })
  @ApiResponse({ status: 200, description: 'Bulk order cancelled' })
  async cancelBulkOrder(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bulkOrderChangeService.cancelBulkOrder(id, user);
  }
}
