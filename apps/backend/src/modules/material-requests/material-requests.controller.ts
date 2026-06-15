import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/permissions';

import {
  ConvertToPoDto,
  ConvertToRfqDto,
  CreateMaterialRequestDto,
  DeclineMaterialRequestDto,
  ListMaterialRequestQueryDto,
  UpdateMaterialRequestDto,
} from './material-requests.dto';
import { MaterialRequestsService } from './material-requests.service';

@ApiTags('Material Requests')
@ApiBearerAuth()
@Controller('material-requests')
export class MaterialRequestsController {
  constructor(private readonly materialRequestsService: MaterialRequestsService) {}

  // ── POST /v1/material-requests ─────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('materialRequest.create')
  @ApiOperation({ summary: 'Create a new material request' })
  @ApiResponse({ status: 201, description: 'Material request created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async create(@Body() dto: CreateMaterialRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.materialRequestsService.create(user, dto);
  }

  // ── GET /v1/material-requests ──────────────────────────────────────────────

  @Get()
  @RequirePermissions('materialRequest.list')
  @ApiOperation({ summary: 'List material requests accessible to the current user' })
  @ApiResponse({ status: 200, description: 'Material requests' })
  async list(@Query() query: ListMaterialRequestQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.materialRequestsService.list(user, query);
  }

  // ── GET /v1/material-requests/:id ──────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('materialRequest.read')
  @ApiOperation({ summary: 'Get a single material request by ID' })
  @ApiResponse({ status: 200, description: 'Material request detail' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialRequestsService.get(id, user);
  }

  // ── GET /v1/material-requests/:id/audit ────────────────────────────────────

  @Get(':id/audit')
  @RequirePermissions('materialRequest.read')
  @ApiOperation({ summary: 'Get the audit/activity trail for a material request' })
  @ApiResponse({ status: 200, description: 'Chronological audit entries for the MR' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async getAuditTrail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialRequestsService.getAuditTrail(id, user);
  }

  // ── PATCH /v1/material-requests/:id ────────────────────────────────────────

  @Patch(':id')
  @RequirePermissions('materialRequest.update')
  @ApiOperation({ summary: 'Update a draft material request' })
  @ApiResponse({ status: 200, description: 'Material request updated' })
  @ApiResponse({ status: 400, description: 'MR is not in DRAFT status or validation error' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialRequestsService.update(id, user, dto);
  }

  // ── POST /v1/material-requests/:id/submit ──────────────────────────────────

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('materialRequest.submit')
  @ApiOperation({ summary: 'Submit a draft material request (DRAFT → SUBMITTED)' })
  @ApiResponse({ status: 200, description: 'Material request submitted' })
  @ApiResponse({ status: 400, description: 'MR is not in DRAFT status' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialRequestsService.submit(id, user);
  }

  // ── POST /v1/material-requests/:id/approve ─────────────────────────────────

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('materialRequest.approve')
  @ApiOperation({ summary: 'Approve a submitted material request (SUBMITTED → APPROVED)' })
  @ApiResponse({ status: 200, description: 'Material request approved' })
  @ApiResponse({ status: 400, description: 'MR is not in SUBMITTED status' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialRequestsService.approve(id, user);
  }

  // ── POST /v1/material-requests/:id/decline ─────────────────────────────────

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('materialRequest.decline')
  @ApiOperation({ summary: 'Decline a submitted material request (reason required)' })
  @ApiResponse({ status: 200, description: 'Material request declined' })
  @ApiResponse({ status: 400, description: 'MR is not in SUBMITTED status' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async decline(
    @Param('id') id: string,
    @Body() dto: DeclineMaterialRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialRequestsService.decline(id, user, dto);
  }

  // ── POST /v1/material-requests/:id/cancel ──────────────────────────────────

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('materialRequest.cancel')
  @ApiOperation({ summary: 'Cancel a material request (requester or approver only)' })
  @ApiResponse({ status: 200, description: 'Material request cancelled' })
  @ApiResponse({ status: 400, description: 'MR cannot be cancelled in its current status' })
  @ApiResponse({ status: 403, description: 'Only the requester or an approver may cancel' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.materialRequestsService.cancel(id, user);
  }

  // ── POST /v1/material-requests/:id/convert-to-rfq ──────────────────────────

  @Post(':id/convert-to-rfq')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('materialRequest.convert')
  @ApiOperation({ summary: 'Convert an approved material request into a draft RFQ' })
  @ApiResponse({ status: 201, description: 'Draft RFQ created from the MR' })
  @ApiResponse({ status: 400, description: 'MR is not in APPROVED status' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async convertToRfq(
    @Param('id') id: string,
    @Body() dto: ConvertToRfqDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialRequestsService.convertToRfq(id, user, dto);
  }

  // ── POST /v1/material-requests/:id/convert-to-po ───────────────────────────

  @Post(':id/convert-to-po')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('materialRequest.convert')
  @ApiOperation({ summary: 'Convert an approved material request into a draft purchase order' })
  @ApiResponse({ status: 201, description: 'Draft PO created from the MR' })
  @ApiResponse({ status: 400, description: 'MR is not in APPROVED status or vendor missing' })
  @ApiResponse({ status: 404, description: 'Material request not found' })
  async convertToPo(
    @Param('id') id: string,
    @Body() dto: ConvertToPoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materialRequestsService.convertToPo(id, user, dto);
  }
}
