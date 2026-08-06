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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import { VendorInviteService } from './vendor-invite.service';
import { VendorUserInviteService } from './vendor-user-invite.service';
import {
  CreateVendorRepresentativeDto,
  CreateWarehouseDto,
  InviteVendorDto,
  InviteVendorUserDto,
  ResolveVendorSelectionDto,
  UpdateVendorCategoriesDto,
  UpdateVendorProfileDto,
  UpdateWarehouseDto,
  VendorListQueryDto,
} from './vendors.dto';
import { VendorsService } from './vendors.service';

@ApiTags('vendors')
@ApiBearerAuth()
@Controller('vendors')
export class VendorsController {
  constructor(
    private readonly vendorsService: VendorsService,
    private readonly vendorInviteService: VendorInviteService,
    private readonly vendorUserInviteService: VendorUserInviteService,
  ) {}

  @Post('invite')
  @RequirePermissions('vendor.invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a vendor to join the platform' })
  @ApiResponse({ status: 201, description: 'Vendor invited successfully' })
  @ApiResponse({ status: 409, description: 'Vendor already assigned or email in use' })
  inviteVendor(@Body() dto: InviteVendorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.vendorInviteService.inviteVendor(dto, user);
  }

  @Get()
  @RequirePermissions('vendor.list')
  @ApiOperation({ summary: 'List vendors for the current contractor' })
  @ApiResponse({ status: 200, description: 'Paginated vendor list' })
  listVendors(@Query() query: VendorListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.listVendors(query, user);
  }

  // ── Vendor Categories (ADR-0018) ──────────────────────────────────────────

  @Post('selection/resolve')
  @RequirePermissions('vendor.list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve a category filter to every matching vendor + sendable rep id',
    description:
      'Backs the RFQ wizard\'s "Add All". Unpaginated by design, and excludes deactivated reps ' +
      'server-side so bulk selection cannot reach a recipient a single selection could not.',
  })
  @ApiResponse({ status: 200, description: 'Vendor and rep ids matching the filter' })
  resolveVendorSelection(
    @Body() dto: ResolveVendorSelectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorsService.resolveVendorSelection(dto, user);
  }

  @Patch(':id/categories')
  @RequirePermissions('vendor.updateCategories')
  @ApiOperation({
    summary: 'Set the Vendor Categories this contractor applies to a vendor',
    description:
      "Replace-semantics; an empty array clears them. Scoped to the caller's own assignment — " +
      "one contractor's categorisation is invisible to every other (ADR-0018).",
  })
  @ApiResponse({ status: 200, description: 'Categories updated' })
  @ApiResponse({
    status: 403,
    description: 'Vendor not assigned to the caller, or caller is a vendor',
  })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  updateVendorCategories(
    @Param('id') id: string,
    @Body() dto: UpdateVendorCategoriesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorsService.updateVendorCategories(id, dto, user);
  }

  // ── Vendor Profile (US-3.07) ──────────────────────────────────────────────

  @Get(':id/profile')
  @RequirePermissions('vendor.readProfile')
  @ApiOperation({ summary: 'Get vendor company profile' })
  @ApiResponse({ status: 200, description: 'Vendor profile' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  getVendorProfile(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.getVendorProfile(id, user);
  }

  @Patch(':id/profile')
  @RequirePermissions('vendor.updateProfile')
  @ApiOperation({ summary: 'Update vendor company profile' })
  @ApiResponse({ status: 200, description: 'Vendor profile updated' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  updateVendorProfile(
    @Param('id') id: string,
    @Body() dto: UpdateVendorProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorsService.updateVendorProfile(id, dto, user);
  }

  // ── Warehouses (US-3.07) ──────────────────────────────────────────────────

  @Post(':id/warehouses')
  @RequirePermissions('vendor.warehouse.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a warehouse location to vendor' })
  @ApiResponse({ status: 201, description: 'Warehouse created' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  addWarehouse(
    @Param('id') id: string,
    @Body() dto: CreateWarehouseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorsService.addWarehouse(id, dto, user);
  }

  @Patch(':id/warehouses/:whId')
  @RequirePermissions('vendor.warehouse.update')
  @ApiOperation({ summary: 'Update a warehouse location' })
  @ApiResponse({ status: 200, description: 'Warehouse updated' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  updateWarehouse(
    @Param('id') id: string,
    @Param('whId') whId: string,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorsService.updateWarehouse(id, whId, dto, user);
  }

  @Delete(':id/warehouses/:whId')
  @RequirePermissions('vendor.warehouse.delete')
  @ApiOperation({ summary: 'Delete a warehouse location' })
  @ApiResponse({ status: 200, description: 'Warehouse deleted' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  deleteWarehouse(
    @Param('id') id: string,
    @Param('whId') whId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorsService.deleteWarehouse(id, whId, user);
  }

  // ── Vendor User Invitation (US-3.10) ──────────────────────────────────────

  @Post(':companyId/users/invite')
  @RequirePermissions('vendor.user.invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a new user to the vendor company' })
  @ApiResponse({ status: 201, description: 'User invitation sent' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  inviteVendorUser(
    @Param('companyId') companyId: string,
    @Body() dto: InviteVendorUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorUserInviteService.inviteVendorUser(companyId, dto, user);
  }

  @Post(':companyId/users/:userId/resend-invitation')
  @RequirePermissions('vendor.user.resendInvitation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend invitation to a vendor user' })
  @ApiResponse({ status: 200, description: 'Invitation resent' })
  @ApiResponse({ status: 404, description: 'User not found' })
  resendInvitation(
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorUserInviteService.resendInvitation(companyId, userId, user);
  }

  @Delete(':companyId/users/:userId/invitation')
  @RequirePermissions('vendor.user.cancelInvitation')
  @ApiOperation({ summary: 'Cancel a pending vendor user invitation' })
  @ApiResponse({ status: 200, description: 'Invitation cancelled' })
  @ApiResponse({ status: 404, description: 'User not found' })
  cancelInvitation(
    @Param('companyId') companyId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorUserInviteService.cancelInvitation(companyId, userId, user);
  }

  // ── Representatives (US-3.12) ─────────────────────────────────────────────

  @Get(':id/representatives')
  @RequirePermissions('vendor.representatives.read')
  @ApiOperation({ summary: 'Get vendor company representatives' })
  @ApiResponse({ status: 200, description: 'List of vendor representatives' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  getRepresentatives(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.getRepresentatives(id, user);
  }

  @Post(':id/representatives')
  @RequirePermissions('vendor.representatives.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a representative without sending an invitation (FOR-272)' })
  @ApiResponse({ status: 201, description: 'Representative added' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  addRepresentative(
    @Param('id') id: string,
    @Body() dto: CreateVendorRepresentativeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorsService.addRepresentative(id, dto, user);
  }

  @Get(':id/representatives/:userId')
  @RequirePermissions('vendor.representatives.read')
  @ApiOperation({ summary: 'Get a single vendor representative' })
  @ApiResponse({ status: 200, description: 'Representative detail' })
  @ApiResponse({ status: 404, description: 'Vendor or representative not found' })
  getRepresentative(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorsService.getRepresentative(id, userId, user);
  }

  @Delete(':id/representatives/:userId')
  @RequirePermissions('vendor.representatives.delete')
  @ApiOperation({ summary: 'Remove a never-activated vendor representative (ADR-0016)' })
  @ApiResponse({ status: 200, description: 'Representative removed' })
  @ApiResponse({ status: 404, description: 'Vendor or representative not found' })
  @ApiResponse({ status: 409, description: 'Representative is active or referenced by RFQs' })
  removeRepresentative(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vendorsService.removeRepresentative(id, userId, user);
  }
}
